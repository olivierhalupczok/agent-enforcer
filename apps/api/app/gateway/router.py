"""B-01: the guarded A2A URL for every proxy agent (contract summary in issue #31).

GET  /a/<agent id>/.well-known/agent-card.json
     The upstream Agent Card, rewritten for the gateway: one JSON-RPC interface at /a/<agent id>,
     no streaming or push notifications, and the key in X-API-Key as the only security scheme.

POST /a/<agent id>
     Accepts A2A SendMessage (JSON-RPC 2.0). Checks the key in X-API-Key (missing or wrong ->
     401), then forwards the call unchanged to the JSON-RPC interface from the upstream's own
     Agent Card, with A2A-Version: 1.0 and the agent's stored auth header. The whole reply is
     read before answering. Other A2A methods get -32004; an unreachable upstream -32603.

The agent's id stands in for the deployment slug until deployments exist (B-03).
"""

import json
from collections.abc import AsyncIterator
from json import JSONDecodeError
from typing import Annotated, Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import HttpUrl, ValidationError

from app.api.routes.agents.deps import ensure_public_upstream
from app.gateway import a2a
from app.gateway.resolver import AgentResolver, get_agent_resolver

UPSTREAM_TIMEOUT_SECONDS = 30.0

router = APIRouter(tags=["gateway"])
_api_key = APIKeyHeader(name=a2a.API_KEY_HEADER, auto_error=False)


class UpstreamError(Exception):
    """The upstream agent couldn't be reached or answered with something unusable."""


async def get_gateway_http_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        follow_redirects=False, timeout=UPSTREAM_TIMEOUT_SECONDS
    ) as client:
        yield client


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
    except ValueError:
        return False
    return True


def _unauthorized() -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Invalid or missing gateway key",
        headers={"WWW-Authenticate": a2a.API_KEY_HEADER},
    )


def _rpc_error(rpc_id: Any, code: int, message: str) -> JSONResponse:
    # JSON-RPC answers HTTP 200 even for errors; the outcome is in the body.
    return JSONResponse(a2a.rpc_error(rpc_id, code, message))


async def _send(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    headers: dict[str, str],
    content: bytes | None = None,
) -> httpx.Response:
    """One call to the upstream, after the SSRF check (public address only, IP pinned)."""
    try:
        upstream = await ensure_public_upstream(HttpUrl(url))
    except (HTTPException, ValidationError) as error:
        raise UpstreamError(f"Upstream address is not allowed: {url}") from error
    request = client.build_request(
        method,
        upstream.url,
        content=content,
        headers=headers,
        extensions={"sni_hostname": upstream.sni_hostname},
    )
    request.headers["Host"] = upstream.host_header
    try:
        # send() without stream=True reads the entire body: streamed replies are buffered.
        return await client.send(request)
    except httpx.TimeoutException as error:
        raise UpstreamError("Upstream agent did not answer in time") from error
    except httpx.HTTPError as error:
        raise UpstreamError("Upstream agent could not be reached") from error


async def _upstream_card(
    client: httpx.AsyncClient, base_url: str, headers: dict[str, str]
) -> dict[str, Any]:
    response = await _send(client, "GET", base_url.rstrip("/") + a2a.AGENT_CARD_PATH, {**headers})
    if response.status_code != status.HTTP_200_OK:
        raise UpstreamError(f"Upstream Agent Card answered {response.status_code}")
    try:
        card = response.json()
    except JSONDecodeError as error:
        raise UpstreamError("Upstream Agent Card is not JSON") from error
    if not isinstance(card, dict):
        raise UpstreamError("Upstream Agent Card is not a JSON object")
    return card


@router.get("/a/{agent_id}" + a2a.AGENT_CARD_PATH)
async def agent_card(
    agent_id: str,
    request: Request,
    resolver: Annotated[AgentResolver, Depends(get_agent_resolver)],
    client: Annotated[httpx.AsyncClient, Depends(get_gateway_http_client)],
) -> JSONResponse:
    base_url = await run_in_threadpool(resolver.base_url, agent_id) if _is_uuid(agent_id) else None
    if base_url is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")
    try:
        upstream_card = await _upstream_card(client, base_url, {})
    except UpstreamError as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error)) from error
    gateway_url = str(request.url_for("forward_to_agent", agent_id=agent_id))
    return JSONResponse(a2a.guarded_card(upstream_card, gateway_url))


@router.post("/a/{agent_id}")
async def forward_to_agent(
    agent_id: str,
    request: Request,
    key: Annotated[str | None, Depends(_api_key)],
    resolver: Annotated[AgentResolver, Depends(get_agent_resolver)],
    client: Annotated[httpx.AsyncClient, Depends(get_gateway_http_client)],
) -> Response:
    if not key or not _is_uuid(agent_id):
        raise _unauthorized()
    target = await run_in_threadpool(resolver.resolve, agent_id, key)
    if target is None:  # unknown agent and wrong key look the same, so ids can't be probed
        raise _unauthorized()

    # --- only A2A SendMessage goes through ---
    body = await request.body()
    try:
        call = json.loads(body)
    except ValueError:
        return _rpc_error(None, a2a.PARSE_ERROR, "Body is not valid JSON")
    if not isinstance(call, dict) or call.get("jsonrpc") != a2a.JSONRPC_VERSION:
        return _rpc_error(None, a2a.INVALID_REQUEST, "Expected a JSON-RPC 2.0 call")
    rpc_id = call.get("id")
    if call.get("method") != a2a.SEND_MESSAGE:
        return _rpc_error(rpc_id, a2a.UNSUPPORTED_OPERATION, "Only SendMessage is supported")
    params = call.get("params")
    if not isinstance(params, dict) or not isinstance(params.get("message"), dict):
        return _rpc_error(rpc_id, a2a.INVALID_PARAMS, "params.message is required")

    # --- forward to the upstream's JSON-RPC interface ---
    auth: dict[str, str] = {}
    if target.auth_header_name and target.auth_header_value:
        auth[target.auth_header_name] = target.auth_header_value
    try:
        interface_url = a2a.jsonrpc_interface_url(
            await _upstream_card(client, target.upstream_url, auth)
        )
        if interface_url is None:
            raise UpstreamError("Upstream Agent Card has no JSON-RPC interface")
        response = await _send(
            client,
            "POST",
            interface_url,
            {
                **auth,
                "Content-Type": "application/json",
                a2a.A2A_VERSION_HEADER: a2a.A2A_VERSION,
            },
            body,
        )
        reply = response.json()
    except UpstreamError as error:
        return _rpc_error(rpc_id, a2a.INTERNAL_ERROR, str(error))
    except JSONDecodeError:
        return _rpc_error(rpc_id, a2a.INTERNAL_ERROR, "Upstream agent returned invalid JSON")

    if not isinstance(reply, dict):
        return _rpc_error(rpc_id, a2a.INTERNAL_ERROR, "Upstream agent returned an invalid response")
    if "error" not in reply and not a2a.is_valid_send_message_result(reply.get("result")):
        return _rpc_error(
            rpc_id,
            a2a.INTERNAL_ERROR,
            "Upstream agent returned an invalid response (a task must be finished)",
        )
    # A result, or the agent's own JSON-RPC error: passed through byte for byte.
    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type", "application/json"),
    )
