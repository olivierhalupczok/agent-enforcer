import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402  (needs the path above)
from app.store import reset_store  # noqa: E402  (needs the path above)


@pytest.fixture(autouse=True)
def fresh_store() -> None:
    reset_store()


@pytest.fixture(autouse=True)
def no_real_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    # apps/api/.env may hold a real Supabase project; tests must never touch that database.
    # Without these settings, guardrails use the in-memory store. Tests that need them set them.
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "")
