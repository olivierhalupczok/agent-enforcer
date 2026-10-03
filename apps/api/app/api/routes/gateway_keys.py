"""B-01: create (or replace) an agent's gateway key. Only the agent's owner can do this (RLS)."""

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.api.routes.agents.deps import AgentDatabase, get_agent_database
from app.gateway.keys import hash_key, new_key

router = APIRouter(prefix="/agents", tags=["agents"])


class GatewayKey(BaseModel):
    agent_id: str
    key: str  # shown only once; store it now
    gateway_path: str


@router.post("/{agent_id}/gateway-key", status_code=status.HTTP_201_CREATED)
async def create_gateway_key(
    agent_id: UUID,
    database: Annotated[AgentDatabase, Depends(get_agent_database)],
) -> GatewayKey:
    key = new_key()
    try:
        response = await run_in_threadpool(
            lambda: (
                database.client.table("agents")
                .update({"gateway_key_hash": hash_key(key)})
                .eq("id", str(agent_id))
                .execute()
            )
        )
    except (APIError, httpx.HTTPError) as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Could not save the gateway key"
        ) from error

    # RLS: updating someone else's agent changes no rows, which looks the same as "not found".
    if not response.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")
    return GatewayKey(agent_id=str(agent_id), key=key, gateway_path=f"/a/{agent_id}")
