from enum import StrEnum

from pydantic import BaseModel, Field, HttpUrl, SecretStr


class MessageFormat(StrEnum):
    JSON = "json"
    TEXT = "text"


class AuthHeader(BaseModel):
    name: str = Field(default="Authorization", min_length=1)
    value: SecretStr


class AgentRegistration(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(max_length=1_000)
    upstream_url: HttpUrl
    auth_header: AuthHeader | None = None
    request_format: MessageFormat
    response_format: MessageFormat


class Agent(BaseModel):
    id: str
    name: str
    description: str
    upstream_url: HttpUrl
    auth_header_name: str | None
    request_format: MessageFormat
    response_format: MessageFormat


class AgentList(BaseModel):
    data: list[Agent]
    total: int
