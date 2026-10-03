"""Vercel entrypoint: re-exports the FastAPI app from the src/ layout."""

from acme_api.main import app

__all__ = ["app"]
