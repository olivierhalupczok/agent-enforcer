from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.guardrails.evaluate import PatternTimeoutError, evaluate
from app.guardrails.models import (
    TEMPLATES,
    DryRunRequest,
    DryRunResult,
    Guardrail,
    GuardrailCreate,
    GuardrailUpdate,
    TemplateInfo,
)
from app.guardrails.repository import GuardrailRepository, get_guardrail_repository
from app.store import store

router = APIRouter(tags=["guardrails"])

Repo = Annotated[GuardrailRepository, Depends(get_guardrail_repository)]


def _get_or_404(repo: GuardrailRepository, guardrail_id: str) -> Guardrail:
    guardrail = repo.get(guardrail_id)
    if guardrail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")
    return guardrail


@router.get("/guardrail-templates")
def list_templates() -> list[TemplateInfo]:
    return list(TEMPLATES.values())


@router.get("/guardrails")
def list_guardrails(repo: Repo) -> list[Guardrail]:
    return repo.list()


@router.post("/guardrails", status_code=status.HTTP_201_CREATED)
def create_guardrail(body: GuardrailCreate, repo: Repo) -> Guardrail:
    guardrail = Guardrail(id=f"gr-{uuid4().hex[:8]}", **body.model_dump())
    repo.add(guardrail)
    return guardrail


@router.post("/guardrails/dry-run")
def dry_run(body: DryRunRequest) -> DryRunResult:
    try:
        return evaluate(body, body.text, list(store.signatures.values()))
    except PatternTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Pattern took too long to run on this text",
        ) from e


@router.get("/guardrails/{guardrail_id}")
def get_guardrail(guardrail_id: str, repo: Repo) -> Guardrail:
    return _get_or_404(repo, guardrail_id)


@router.patch("/guardrails/{guardrail_id}")
def update_guardrail(guardrail_id: str, body: GuardrailUpdate, repo: Repo) -> Guardrail:
    current = _get_or_404(repo, guardrail_id)
    updated = current.model_copy(update=body.model_dump(exclude_unset=True))
    repo.replace(updated)
    return updated


@router.delete("/guardrails/{guardrail_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guardrail(guardrail_id: str, repo: Repo) -> Response:
    if not repo.delete(guardrail_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardrail not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
