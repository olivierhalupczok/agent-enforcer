"""FR-16: register MCP servers (URL, auth, allowed tools)."""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.mcp.models import McpServer, McpServerCreate
from app.mcp.repository import McpServerRepository, NameTakenError, get_mcp_server_repository

router = APIRouter(prefix="/mcp-servers", tags=["mcp-servers"])

Repo = Annotated[McpServerRepository, Depends(get_mcp_server_repository)]


@router.get("")
def list_mcp_servers(repo: Repo) -> list[McpServer]:
    return repo.list()


@router.get("/{server_id}")
def get_mcp_server(server_id: str, repo: Repo) -> McpServer:
    server = repo.get(server_id)
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MCP server not found")
    return server


@router.post("", status_code=status.HTTP_201_CREATED)
def register_mcp_server(body: McpServerCreate, repo: Repo) -> McpServer:
    try:
        return repo.add(f"mcp-{uuid4().hex[:8]}", body)
    except NameTakenError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"MCP server '{body.name}' already exists"
        ) from error


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcp_server(server_id: str, repo: Repo) -> Response:
    if not repo.delete(server_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MCP server not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
