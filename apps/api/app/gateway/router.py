"""B-01: the guarded URL for every proxy agent, POST /a/<agent id>.

1. Check the caller's gateway key (Authorization: Bearer gk_...). Missing or wrong -> 401.
2. Forward the request body unchanged to the agent's upstream_url, adding the agent's own
   upstream auth header if it has one.
3. Read the whole reply before answering. A streamed upstream reply is therefore buffered in
   full, so output guardrails (B-02) can later check the complete text.

No guardrails run yet (B-02): with none attached, the agent's reply comes back unchanged.
"""

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import HttpUrl

from app.api.routes.agents.deps import ensure_public_upstream
from app.gateway.resolver import AgentResolver, get_agent_resolver

UPSTREAM_TIMEOUT_SECONDS = 30.0

router = APIRouter(tags=["gateway"])
_bearer = HTTPBearer(auto_error=False)


async def get_gateway_http_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        follow_redirects=False, timeout=UPSTREAM_TIMEOUT_SECONDS
    ) as client:
        yield client


def _unauthorized() -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Invalid or missing gateway key",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/a/{agent_id}")
async def forward_to_agent(
    agent_id: str,
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    resolver: Annotated[AgentResolver, Depends(get_agent_resolver)],
    client: Annotated[httpx.AsyncClient, Depends(get_gateway_http_client)],
) -> Response:
    if credentials is None:
        raise _unauthorized()
    try:
        UUID(agent_id)
    except ValueError as error:
        raise _unauthorized() from error

    target = await run_in_threadpool(resolver.resolve, agent_id, credentials.credentials)
    if target is None:  # unknown agent and wrong key look the same, so ids can't be probed
        raise _unauthorized()

    upstream = await ensure_public_upstream(HttpUrl(target.upstream_url))
    headers = {"Content-Type": request.headers.get("content-type", "application/json")}
    if target.auth_header_name and target.auth_header_value:
        headers[target.auth_header_name] = target.auth_header_value

    try:
        upstream_request = client.build_request(
            "POST",
            upstream.url,
            content=await request.body(),
            headers=headers,
            extensions={"sni_hostname": upstream.sni_hostname},
        )
        upstream_request.headers["Host"] = upstream.host_header
        # send() without stream=True reads the entire body: streamed replies are buffered here.
        upstream_response = await client.send(upstream_request)
    except httpx.TimeoutException as error:
        raise HTTPException(
            status.HTTP_504_GATEWAY_TIMEOUT, "Upstream agent did not answer in time"
        ) from error
    except httpx.HTTPError as error:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Upstream agent could not be reached"
        ) from error

    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        media_type=upstream_response.headers.get("content-type"),
    )
