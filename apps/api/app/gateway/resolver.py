"""Find where to forward a gateway call: the agent's upstream, if the caller's key is right."""

from dataclasses import dataclass
from typing import Any, Protocol, cast

import httpx
from fastapi import HTTPException, status
from postgrest.exceptions import APIError

from app.core.supabase import get_supabase
from app.gateway.keys import hash_key
from supabase import Client


@dataclass(frozen=True)
class UpstreamTarget:
    upstream_url: str
    auth_header_name: str | None = None
    auth_header_value: str | None = None


class AgentResolver(Protocol):
    def resolve(self, agent_id: str, key: str) -> UpstreamTarget | None:
        """The agent's upstream, or None when the agent is unknown or the key is wrong."""
        ...


class SupabaseAgentResolver:
    """Calls the gateway_resolve_agent database function (see the agents_gateway_key migration)."""

    def __init__(self, client: Client) -> None:
        self._client = client

    def resolve(self, agent_id: str, key: str) -> UpstreamTarget | None:
        try:
            response = self._client.rpc(
                "gateway_resolve_agent",
                {"p_agent_id": agent_id, "p_key_hash": hash_key(key)},
            ).execute()
        except (APIError, httpx.HTTPError) as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "Gateway could not look up the agent"
            ) from error
        rows = cast(list[dict[str, Any]], response.data or [])
        if not rows:
            return None
        row = rows[0]
        return UpstreamTarget(
            upstream_url=str(row["upstream_url"]),
            auth_header_name=row.get("auth_header_name"),
            auth_header_value=row.get("auth_header_value"),
        )


def get_agent_resolver() -> AgentResolver:
    try:
        return SupabaseAgentResolver(get_supabase())
    except RuntimeError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Gateway is not configured"
        ) from error
