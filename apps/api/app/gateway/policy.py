"""Which guardrails the gateway runs for an agent: the mandatory ones plus the agent's bindings.

The gateway has no signed-in user, so it can't read guardrails through RLS. Like the agent
lookup, it calls a database function that answers only to a caller holding the agent's key.
"""

from typing import Any, Protocol

import httpx
from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from pydantic import ValidationError

from app.bindings.models import Binding, EffectivePolicy
from app.bindings.resolve import resolve
from app.core.supabase import get_supabase
from app.gateway.keys import hash_key
from app.guardrails.models import Guardrail
from supabase import Client


class PolicyLoader(Protocol):
    def load(self, agent_id: str, key: str) -> EffectivePolicy:
        """The guardrails to run for this agent, in order, split by stage."""
        ...


class SupabasePolicyLoader:
    """Calls the gateway_agent_guardrails database function (see its migration)."""

    def __init__(self, client: Client) -> None:
        self._client = client

    def load(self, agent_id: str, key: str) -> EffectivePolicy:
        try:
            response = self._client.rpc(
                "gateway_agent_guardrails",
                {"p_agent_id": agent_id, "p_key_hash": hash_key(key)},
            ).execute()
        except (APIError, httpx.HTTPError) as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "Gateway could not load the guardrails"
            ) from error

        data: Any = response.data
        if not isinstance(data, dict):  # wrong key: the function returns null
            return resolve([], [], agent_id=agent_id)
        try:
            guardrails = [Guardrail.model_validate(row) for row in data.get("guardrails") or []]
            bindings = [Binding.model_validate(row) for row in data.get("bindings") or []]
        except ValidationError as error:
            # Fail closed: never forward a call when a stored guardrail can't be understood.
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "A stored guardrail is invalid"
            ) from error
        return resolve(guardrails, bindings, agent_id=agent_id)


def get_policy_loader() -> PolicyLoader:
    try:
        return SupabasePolicyLoader(get_supabase())
    except RuntimeError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Gateway is not configured"
        ) from error
