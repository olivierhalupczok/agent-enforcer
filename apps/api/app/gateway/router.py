"""B-01: the guarded A2A URL for every proxy agent (contract summary in issue #31).

GET  /a/<agent id>/.well-known/agent-card.json
     The upstream Agent Card, rewritten for the gateway: one JSON-RPC interface at /a/<agent id>,
     no streaming or push notifications, and the key in X-API-Key as the only security scheme.

POST /a/<agent id>
     Accepts A2A SendMessage (JSON-RPC 2.0). Checks the key in X-API-Key (missing or wrong ->
     401), runs the resolved input guardrails, forwards the (possibly redacted) call to the
     JSON-RPC interface from the upstream's own Agent Card, then runs the output guardrails.
     The reply carries metadata.guardrailHub.trace. A block is a TASK_STATE_REJECTED task and
     does not reach the agent. Other A2A methods get -32004; an unreachable upstream -32603.

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

from app.api.deps import get_role
from app.api.routes.agents.deps import ensure_public_upstream
from app.bindings.repository import BindingRepository, get_binding_repository_for_gateway
from app.bindings.resolve import resolve_for_request
from app.gateway import a2a, enforce
from app.gateway.resolver import AgentResolver, get_agent_resolver
from app.guardrails.repository import GuardrailRepository, get_guardrail_repository_for_gateway
from app.store import store

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


def _context_id(message: dict[str, Any]) -> Any:
    return message.get("contextId")


@router.post("/a/{agent_id}")
async def forward_to_agent(
    agent_id: str,
    request: Request,
    key: Annotated[str | None, Depends(_api_key)],
    resolver: Annotated[AgentResolver, Depends(get_agent_resolver)],
    client: Annotated[httpx.AsyncClient, Depends(get_gateway_http_client)],
    guardrails: Annotated[GuardrailRepository, Depends(get_guardrail_repository_for_gateway)],
    bindings: Annotated[BindingRepository, Depends(get_binding_repository_for_gateway)],
    header_role: Annotated[str | None, Depends(get_role)],
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

    caller, stripped = enforce.read_caller(call, header_role)
    policy = await run_in_threadpool(
        resolve_for_request, guardrails, bindings, agent_id, caller.role, caller.user_id
    )
    signatures = list(store.signatures.values())
    message = params["message"]
    incoming = await run_in_threadpool(
        enforce.run_stage, policy, "input", message.get("parts"), signatures
    )
    if incoming.blocked:
        hub = enforce.hub_metadata(policy, caller, incoming.trace, incoming.blocked)
        return JSONResponse(
            a2a.rejected_task(
                rpc_id, _context_id(message), incoming.blocked.refusal(), {enforce.HUB_KEY: hub}
            )
        )

    forward_body = json.dumps(call).encode() if stripped or incoming.rewritten else body

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
            forward_body,
        )
        reply = response.json()
    except UpstreamError as error:
        return _rpc_error(rpc_id, a2a.INTERNAL_ERROR, str(error))
    except JSONDecodeError:
        return _rpc_error(rpc_id, a2a.INTERNAL_ERROR, "Upstream agent returned invalid JSON")

    if not isinstance(reply, dict):
        return _rpc_error(rpc_id, a2a.INTERNAL_ERROR, "Upstream agent returned an invalid response")
    if "error" in reply:
        # The agent's own JSON-RPC error: passed through. Guardrails do not rewrite errors.
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
        )
    if not a2a.is_valid_send_message_result(reply.get("result")):
        return _rpc_error(
            rpc_id,
            a2a.INTERNAL_ERROR,
            "Upstream agent returned an invalid response (a task must be finished)",
        )

    outgoing = await run_in_threadpool(
        enforce.run_stage, policy, "output", a2a.result_text_parts(reply.get("result")), signatures
    )
    trace = [*incoming.trace, *outgoing.trace]
    if outgoing.blocked:
        hub = enforce.hub_metadata(policy, caller, trace, outgoing.blocked)
        return JSONResponse(
            a2a.rejected_task(
                rpc_id, _context_id(message), outgoing.blocked.refusal(), {enforce.HUB_KEY: hub}
            )
        )
    container = a2a.result_container(reply.get("result"))
    if container is not None:
        enforce.attach_hub(container, enforce.hub_metadata(policy, caller, trace))
    return JSONResponse(reply)
