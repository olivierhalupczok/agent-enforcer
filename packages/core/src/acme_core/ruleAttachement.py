from pydantic import BaseModel, Field
from typing import Literal

class RuleAttachment(BaseModel):
    rule_id: str = Field(..., description="The unique ID of the attached guardrail or policy")
    rule_type: Literal["guardrail", "policy"] = Field(
        ..., 
        description="Indicates if the attached entity is a single guardrail or a policy group"
    )
    order_index: int = Field(..., description="The execution sequence order for the proxy engine")

class Agent(BaseModel):
    id: str
    name: str
    upstream_url: str
    # ... your other existing agent fields (auth_header, etc.) ...
    
    attached_rules: list[RuleAttachment] = Field(
        default_factory=list, 
        description="Ordered list of guardrails and policies attached to this agent"
    )