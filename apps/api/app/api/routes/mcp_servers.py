"""FR-16: register MCP servers (URL, auth, allowed tools)."""

import re
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import AnyHttpUrl, BaseModel, Field, SecretStr, field_validator

# MCP tool names: letters, digits, underscore, hyphen, dot (e.g. get_order, search_docs)
TOOL_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")


# --- auth (the discriminator is "type") ---
class NoAuth(BaseModel):
    type: Literal["none"]


class ApiKeyAuth(BaseModel):
    type: Literal["api_key"]
    header: str = Field(default="Authorization", min_length=1)
    api_key: SecretStr = Field(min_length=1)


class OAuthAuth(BaseModel):
    type: Literal["oauth"]
    token_url: AnyHttpUrl
    client_id: str = Field(min_length=1)
    client_secret: SecretStr = Field(min_length=1)
    scopes: list[str] = Field(default_factory=list)


Auth = Annotated[NoAuth | ApiKeyAuth | OAuthAuth, Field(discriminator="type")]


# --- what the API returns: never the secret itself ---
class AuthSummary(BaseModel):
    type: Literal["none", "api_key", "oauth"]
    header: str | None = None
    client_id: str | None = None
    scopes: list[str] = Field(default_factory=list)
    has_secret: bool


def summarize(auth: NoAuth | ApiKeyAuth | OAuthAuth) -> AuthSummary:
    if isinstance(auth, ApiKeyAuth):
        return AuthSummary(type="api_key", header=auth.header, has_secret=True)
    if isinstance(auth, OAuthAuth):
        return AuthSummary(
            type="oauth", client_id=auth.client_id, scopes=auth.scopes, has_secret=True
        )
    return AuthSummary(type="none", has_secret=False)


# --- request / response ---
class McpServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    url: AnyHttpUrl
    auth: Auth
    allowed_tools: list[str] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("allowed_tools")
    @classmethod
    def valid_unique_tools(cls, tools: list[str]) -> list[str]:
        bad = [t for t in tools if not TOOL_NAME.match(t)]
        if bad:
            raise ValueError(f"invalid tool names: {', '.join(bad)}")
        if len(set(tools)) != len(tools):
            raise ValueError("allowed_tools must be unique")
        return tools


class McpServer(BaseModel):
    id: str
    name: str
    url: AnyHttpUrl
    auth: AuthSummary
    allowed_tools: list[str]
    agents: int = 0  # number of agents using it; filled in once FR-17 attaches servers to agents


# in-memory until A-01 adds SQLite; keeps the full auth (with secrets) for the gateway
_SERVERS: dict[str, tuple[McpServerCreate, McpServer]] = {}

router = APIRouter(prefix="/mcp-servers", tags=["mcp-servers"])


@router.get("")
def list_mcp_servers() -> list[McpServer]:
    return [public for _, public in _SERVERS.values()]


@router.get("/{server_id}")
def get_mcp_server(server_id: str) -> McpServer:
    if server_id not in _SERVERS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MCP server not found")
    return _SERVERS[server_id][1]


@router.post("", status_code=status.HTTP_201_CREATED)
def register_mcp_server(body: McpServerCreate) -> McpServer:
    if any(public.name.lower() == body.name.lower() for _, public in _SERVERS.values()):
        raise HTTPException(status.HTTP_409_CONFLICT, f"MCP server '{body.name}' already exists")
    server = McpServer(
        id=f"mcp-{uuid4().hex[:8]}",
        name=body.name,
        url=body.url,
        auth=summarize(body.auth),
        allowed_tools=body.allowed_tools,
    )
    _SERVERS[server.id] = (body, server)
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcp_server(server_id: str) -> None:
    if _SERVERS.pop(server_id, None) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MCP server not found")
