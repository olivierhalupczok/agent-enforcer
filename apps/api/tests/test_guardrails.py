from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_create_pii_redact() -> None:
    r = client.post(
        "/api/v1/guardrails",
        json={
            "name": "PII",
            "stages": ["input"],
            "action": "redact",
            "config": {"template": "pii"},
        },
    )
    assert r.status_code == 201
    assert r.json()["engine"] == "pii"


def test_redact_not_allowed_for_toxicity() -> None:
    r = client.post(
        "/api/v1/guardrails",
        json={
            "name": "Tox",
            "stages": ["output"],
            "action": "redact",
            "config": {"template": "toxicity"},
        },
    )
    assert r.status_code == 422


def test_bad_regex_rejected() -> None:
    r = client.post(
        "/api/v1/guardrails",
        json={
            "name": "Bad",
            "stages": ["input"],
            "action": "block",
            "config": {"template": "regex", "pattern": "(unclosed"},
        },
    )
    assert r.status_code == 422
