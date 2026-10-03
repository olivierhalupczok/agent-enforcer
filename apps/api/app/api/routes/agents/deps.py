import socket
from collections.abc import AsyncIterator
from dataclasses import dataclass
from ipaddress import ip_address
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import HttpUrl
from supabase_auth.errors import AuthApiError

from app.core.supabase import get_supabase_for_user
from supabase import Client

_bearer = HTTPBearer()


@dataclass(frozen=True)
class AgentDatabase:
    client: Client
    owner_id: str


def get_agent_database(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> AgentDatabase:
    token = credentials.credentials
    try:
        client = get_supabase_for_user(token)
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured",
        ) from error
    try:
        response = client.auth.get_user(token)
    except AuthApiError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token",
        ) from error
    user = response.user if response is not None else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token",
        )
    return AgentDatabase(client=client, owner_id=str(user.id))


async def ensure_public_upstream(url: HttpUrl) -> None:
    """Reject upstreams resolving to local, private, or otherwise non-public addresses."""
    if url.username is not None or url.password is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Upstream URL must not contain credentials",
        )

    host = url.host
    if host is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Upstream URL must have a hostname",
        )
    host = host.removeprefix("[").removesuffix("]")

    try:
        addresses = {ip_address(host)}
    except ValueError:
        port = url.port or (443 if url.scheme == "https" else 80)
        try:
            records = await run_in_threadpool(
                socket.getaddrinfo,
                host,
                port,
                0,
                socket.SOCK_STREAM,
            )
        except socket.gaierror as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Upstream hostname could not be resolved",
            ) from error
        addresses = {ip_address(record[4][0]) for record in records}

    if not addresses or any(not address.is_global for address in addresses):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Upstream URL must resolve only to public IP addresses",
        )


async def get_http_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(follow_redirects=False, timeout=5.0) as client:
        yield client
