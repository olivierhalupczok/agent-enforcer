"""The A2A 1.0 pieces the gateway reads and writes (contract summary in issue #31).

A2A 1.0 uses protobuf JSON: camelCase keys and enum values like "TASK_STATE_COMPLETED".
"""

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
