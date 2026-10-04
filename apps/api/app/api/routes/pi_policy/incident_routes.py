"""Incidents endpoints (tag: pi-incidents).

Read-only view of the pi control layer's incident file, plus the manual
ban/unban actions for the human-in-the-loop governance flow.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.pi_policy.incidents import ban_url, read_incidents, unban_url
from app.pi_policy.service import PolicyFileService, get_policy_service

router = APIRouter(prefix="/pi/incidents", tags=["pi-incidents"])

Service = Annotated[PolicyFileService, Depends(get_policy_service)]


class BanRequest(BaseModel):
    url: str


@router.get("")
def list_incidents() -> list[dict[str, object]]:
    return read_incidents()


@router.post("/ban-link")
def ban_link(body: BanRequest, service: Service) -> dict[str, object]:
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="url must be an http(s) URL"
        )
    try:
        return ban_url(url, service)
    except Exception as e:  # noqa: BLE001 — surface policy write failures to the UI
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ban failed: {e}") from e


@router.post("/unban-link")
def unban_link(body: BanRequest, service: Service) -> dict[str, object]:
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="url must be an http(s) URL"
        )
    try:
        return unban_url(url, service)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unban failed: {e}"
        ) from e
