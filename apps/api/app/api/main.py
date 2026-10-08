from dotenv import load_dotenv
from fastapi import APIRouter

from app.api.routes import (
    agent_mcp_servers,
    audit,
    bindings,
    gateway_keys,
    guardrails,
    items,
    mcp_servers,
    security,
    signatures,
    test_chat,
)
from app.api.routes.agents.router import router as agents_router

load_dotenv()

api_router = APIRouter()
api_router.include_router(items.router)
api_router.include_router(guardrails.router)
api_router.include_router(bindings.router)
api_router.include_router(agents_router)
api_router.include_router(gateway_keys.router)
api_router.include_router(test_chat.router)
api_router.include_router(security.router)
api_router.include_router(mcp_servers.router)
api_router.include_router(agent_mcp_servers.router)
api_router.include_router(signatures.router)
api_router.include_router(audit.router)
