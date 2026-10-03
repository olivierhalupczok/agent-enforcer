from datetime import UTC, datetime

from app.core.supabase import get_supabase as _get_supabase
from supabase import Client


def get_timestamp() -> str:
    """Return the current UTC timestamp in ISO 8601 format."""
    return datetime.now(UTC).isoformat()


def get_supabase() -> Client:
    """FastAPI dependency returning the shared Supabase client."""
    return _get_supabase()
