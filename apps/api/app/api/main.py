from fastapi import APIRouter

from app.api.routes import guardrails, items, mcp_servers

api_router = APIRouter()
api_router.include_router(items.router)

api_router.include_router(guardrails.router)
api_router.include_router(mcp_servers.router)
