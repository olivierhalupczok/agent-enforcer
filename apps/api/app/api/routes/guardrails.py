import re
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, status
from pydantic import BaseModel, Field, field_validator, model_validator

Stage = Literal["input", "output"]
Action = Literal["block", "redact", "warn"]
TemplateId = Literal["pii", "prompt_injection", "toxicity", "topic", "regex", "llm_judge"]


# --- per-template config (the discriminator is "template") ---
class PiiConfig(BaseModel):
    template: Literal["pii"]
    entities: list[str] = Field(default=["EMAIL", "PHONE", "CREDIT_CARD", "IBAN"], min_length=1)


class PromptInjectionConfig(BaseModel):
    template: Literal["prompt_injection"]
    use_company_signatures: bool = True


class ToxicityConfig(BaseModel):
    template: Literal["toxicity"]
    threshold: float = Field(default=0.7, ge=0, le=1)


class TopicConfig(BaseModel):
    template: Literal["topic"]
    mode: Literal["allow", "deny"]
    topics: list[str] = Field(min_length=1)


class RegexConfig(BaseModel):
    template: Literal["regex"]
    pattern: str = Field(min_length=1)
    replacement: str = "[REDACTED]"

    @field_validator("pattern")
    @classmethod
    def must_compile(cls, v: str) -> str:
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f"invalid regex: {e}") from e
        return v


class LlmJudgeConfig(BaseModel):
    template: Literal["llm_judge"]
    prompt: str = Field(min_length=10)


GuardrailConfig = Annotated[
    PiiConfig | PromptInjectionConfig | ToxicityConfig | TopicConfig | RegexConfig | LlmJudgeConfig,
    Field(discriminator="template"),
]


# --- template catalog: engine + allowed actions ---
class TemplateInfo(BaseModel):
    id: TemplateId
    label: str
    engine: str
    actions: list[Action]


TEMPLATES: dict[str, TemplateInfo] = {
    t.id: t
    for t in [
        TemplateInfo(id="pii", label="PII", engine="pii", actions=["block", "redact", "warn"]),
        TemplateInfo(
            id="prompt_injection",
            label="Prompt injection",
            engine="regex",
            actions=["block", "warn"],
        ),
        TemplateInfo(
            id="toxicity", label="Toxicity", engine="moderation", actions=["block", "warn"]
        ),
        TemplateInfo(
            id="topic", label="Topic allow/deny list", engine="llm_judge", actions=["block", "warn"]
        ),
        TemplateInfo(
            id="regex", label="Regex", engine="regex", actions=["block", "redact", "warn"]
        ),
        TemplateInfo(
            id="llm_judge", label="LLM judge", engine="llm_judge", actions=["block", "warn"]
        ),
    ]
}


# --- request / response ---
class GuardrailCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    stages: list[Stage] = Field(min_length=1)
    action: Action
    config: GuardrailConfig

    @model_validator(mode="after")
    def check_action_and_stages(self) -> "GuardrailCreate":
        allowed = TEMPLATES[self.config.template].actions
        if self.action not in allowed:
            raise ValueError(
                f"action '{self.action}' not allowed for template "
                f"'{self.config.template}' (allowed: {', '.join(allowed)})"
            )
        if len(set(self.stages)) != len(self.stages):
            raise ValueError("stages must be unique")
        return self


class Guardrail(GuardrailCreate):
    id: str
    engine: str  # filled in from the template; a guardrail can never lack an engine (A-03)
    enabled: bool = True


# in-memory until A-01 adds SQLite
_GUARDRAILS: dict[str, Guardrail] = {}

router = APIRouter(tags=["guardrails"])


@router.get("/guardrail-templates")
def list_templates() -> list[TemplateInfo]:
    return list(TEMPLATES.values())


@router.get("/guardrails")
def list_guardrails() -> list[Guardrail]:
    return list(_GUARDRAILS.values())


@router.post("/guardrails", status_code=status.HTTP_201_CREATED)
def create_guardrail(body: GuardrailCreate) -> Guardrail:
    guardrail = Guardrail(
        id=f"gr-{uuid4().hex[:8]}",
        engine=TEMPLATES[body.config.template].engine,
        **body.model_dump(),
    )
    _GUARDRAILS[guardrail.id] = guardrail
    return guardrail
