"""FR-16 models: MCP servers with a URL, auth and allowed tools."""

import re
from typing import Annotated, Literal

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
