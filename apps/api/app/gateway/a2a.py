"""The A2A 1.0 pieces the gateway reads and writes (contract summary in issue #31).

A2A 1.0 uses protobuf JSON: camelCase keys and enum values like "TASK_STATE_COMPLETED".
"""

import uuid
from typing import Any

JSONRPC_VERSION = "2.0"
SEND_MESSAGE = "SendMessage"
A2A_VERSION_HEADER = "A2A-Version"
A2A_VERSION = "1.0"
AGENT_CARD_PATH = "/.well-known/agent-card.json"
JSONRPC_BINDING = "JSONRPC"

# The header callers put their per-deployment key in; the only security scheme on our card.
API_KEY_HEADER = "X-API-Key"
API_KEY_SCHEME = "apiKey"

PARSE_ERROR = -32700
INVALID_REQUEST = -32600
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
UNSUPPORTED_OPERATION = -32004

# A finished task. Anything else (submitted, working, input required, ...) would need the
# caller to poll or stream, which the gateway doesn't offer, so it's an invalid response.
TERMINAL_TASK_STATES = frozenset(
    {
        "TASK_STATE_COMPLETED",
        "TASK_STATE_FAILED",
        "TASK_STATE_CANCELED",
        "TASK_STATE_REJECTED",
    }
)

Json = dict[str, Any]


def rpc_error(rpc_id: Any, code: int, message: str) -> Json:
    return {"jsonrpc": JSONRPC_VERSION, "id": rpc_id, "error": {"code": code, "message": message}}


def jsonrpc_interface_url(card: Json) -> str | None:
    """Where the upstream agent takes JSON-RPC calls, from its own Agent Card."""
    for interface in card.get("supportedInterfaces") or []:
        if (
            isinstance(interface, dict)
            and interface.get("protocolBinding") == JSONRPC_BINDING
            and isinstance(interface.get("url"), str)
        ):
            return str(interface["url"])
    return None


# Signatures are dropped too: they sign the upstream's card, not ours.
_REPLACED = {"supportedInterfaces", "securitySchemes", "securityRequirements", "signatures"}


def guarded_card(upstream_card: Json, gateway_url: str) -> Json:
    """The upstream Agent Card, rewritten so every call goes through the gateway.

    Name, description, skills and the like are kept. The interfaces, capabilities and
    security are replaced: one JSON-RPC interface at the guarded URL, no streaming or push
    notifications, and the deployment's key in X-API-Key as the only way in.
    """
    card = {key: value for key, value in upstream_card.items() if key not in _REPLACED}
    capabilities = upstream_card.get("capabilities")
    card["capabilities"] = {
        **(capabilities if isinstance(capabilities, dict) else {}),
        "streaming": False,
        "pushNotifications": False,
        # The extended card would come from the upstream unguarded; we don't serve it.
        "extendedAgentCard": False,
    }
    card["supportedInterfaces"] = [
        {"url": gateway_url, "protocolBinding": JSONRPC_BINDING, "protocolVersion": A2A_VERSION}
    ]
    card["securitySchemes"] = {
        API_KEY_SCHEME: {
            "apiKeySecurityScheme": {
                "location": "header",
                "name": API_KEY_HEADER,
                "description": "The deployment's gateway key",
            }
        }
    }
    card["securityRequirements"] = [{"schemes": {API_KEY_SCHEME: {}}}]
    return card


def result_container(result: Any) -> Json | None:
    """Where hub metadata belongs in a SendMessage result: the message, or the task."""
    if not isinstance(result, dict):
        return None
    for key in ("message", "task"):
        value = result.get(key)
        if isinstance(value, dict):
            return value
    return None


def result_text_parts(result: Any) -> list[Json]:
    """Every parts list in a reply that output guardrails may read, in reading order.

    A message has one. A task has its artifacts' parts, then its status message's (contract
    section 3). The dicts are the ones from the parsed reply, so rewriting them redacts it.
    """
    container = result_container(result)
    if container is None:
        return []
    if isinstance(result, dict) and isinstance(result.get("message"), dict):
        parts = container.get("parts")
        return list(parts) if isinstance(parts, list) else []

    collected: list[Json] = []
    for artifact in container.get("artifacts") or []:
        if isinstance(artifact, dict) and isinstance(artifact.get("parts"), list):
            collected.extend(artifact["parts"])
    status = container.get("status")
    message = status.get("message") if isinstance(status, dict) else None
    if isinstance(message, dict) and isinstance(message.get("parts"), list):
        collected.extend(message["parts"])
    return collected


def rejected_task(rpc_id: Any, context_id: Any, text: str, metadata: Json) -> Json:
    """A refusal the caller can read: a finished task in TASK_STATE_REJECTED (contract section 5).

    Used when a guardrail blocks, so a blocked call is still a valid A2A answer rather than an
    error the client has to special-case.
    """
    task: Json = {
        "id": f"blk-{uuid.uuid4().hex[:12]}",
        "status": {
            "state": "TASK_STATE_REJECTED",
            "message": {
                "messageId": str(uuid.uuid4()),
                "role": "ROLE_AGENT",
                "parts": [{"text": text}],
            },
        },
        "metadata": metadata,
    }
    if isinstance(context_id, str) and context_id:
        task["contextId"] = context_id
        task["status"]["message"]["contextId"] = context_id
    return {"jsonrpc": JSONRPC_VERSION, "id": rpc_id, "result": {"task": task}}


def is_valid_send_message_result(result: Any) -> bool:
    """A SendMessage result is a message, or a task that has finished."""
    if not isinstance(result, dict):
        return False
    if isinstance(result.get("message"), dict):
        return True
    task = result.get("task")
    if not isinstance(task, dict):
        return False
    status = task.get("status")
    return isinstance(status, dict) and status.get("state") in TERMINAL_TASK_STATES
