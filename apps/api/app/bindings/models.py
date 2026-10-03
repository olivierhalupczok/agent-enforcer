"""FR-05: which guardrails apply to a request.

A binding attaches one guardrail from the library to one scope: an agent (what the agent can
do), a role (what a rank of employee may see) or a single user (an exemption or an extra
check). A request is resolved against all three at once, so the same guardrail can arrive
from more than one side.

Guardrails marked `is_mandatory` (FR-06) need no binding: they apply everywhere, run first
and cannot be attached or detached.
"""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

from app.guardrails.models import Guardrail, Stage

ScopeType = Literal["agent", "role", "user"]
Source = Literal["mandatory", "agent", "role", "user"]

# Two bindings with the same order_index are ordered by the scope they came from: an agent
# binding is about the agent's own capabilities, so it runs before role and user ones.
SCOPE_RANK: dict[Source, int] = {"mandatory": 0, "agent": 1, "role": 2, "user": 3}


class BindingCreate(BaseModel):
    scope_type: ScopeType
    scope_id: str = Field(min_length=1, max_length=120)
    guardrail_id: str = Field(min_length=1, max_length=60)
    order_index: int = Field(default=0, ge=0, le=9999)
    enabled: bool = True


class Binding(BindingCreate):
    id: str


class BindingUpdate(BaseModel):
    """Reorder (FR-05 "set execution order") or pause a binding without detaching it."""

    order_index: int | None = Field(default=None, ge=0, le=9999)
    enabled: bool | None = None

    @model_validator(mode="after")
    def no_nulls_and_not_empty(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("send order_index, enabled or both")
        for field in ("order_index", "enabled"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class EffectiveGuardrail(BaseModel):
    """One guardrail in the resolved set, with the reason it is there."""

    guardrail: Guardrail
    source: Source
    binding_id: str | None = None  # mandatory guardrails have no binding
    order_index: int


class EffectivePolicy(BaseModel):
    """What the gateway enforces for one (agent, role, user) triple."""

    agent_id: str | None
    role: str | None
    user_id: str | None
    version: str
    input: list[EffectiveGuardrail]
    output: list[EffectiveGuardrail]

    def stage(self, stage: Stage) -> list[EffectiveGuardrail]:
        return self.input if stage == "input" else self.output
