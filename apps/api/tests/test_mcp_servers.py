from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
URL = "/api/v1/mcp-servers"


def order_lookup(name: str = "Order lookup") -> dict[str, object]:
    return {
        "name": name,
        "url": "https://mcp.acme.dev/orders",
        "auth": {"type": "api_key", "api_key": "sk-test-123"},
        "allowed_tools": ["get_order", "get_return_status", "list_orders"],
    }


def test_register_with_api_key_hides_secret() -> None:
    r = client.post(URL, json=order_lookup("Orders A"))
    assert r.status_code == 201
    body = r.json()
    assert body["auth"] == {
        "type": "api_key",
        "header": "Authorization",
        "client_id": None,
        "scopes": [],
        "has_secret": True,
    }
    assert "sk-test-123" not in r.text
    assert body["allowed_tools"] == ["get_order", "get_return_status", "list_orders"]


def test_register_oauth_and_fetch_by_id() -> None:
    r = client.post(
        URL,
        json={
            "name": "Knowledge base",
            "url": "https://mcp.acme.dev/kb",
            "auth": {
                "type": "oauth",
                "token_url": "https://auth.acme.dev/token",
                "client_id": "kb-client",
                "client_secret": "super-secret",
                "scopes": ["docs.read"],
            },
            "allowed_tools": ["search_docs", "get_doc"],
        },
    )
    assert r.status_code == 201
    assert "super-secret" not in r.text
    got = client.get(f"{URL}/{r.json()['id']}")
    assert got.status_code == 200
    assert got.json()["auth"]["client_id"] == "kb-client"


def test_duplicate_name_conflicts() -> None:
    assert client.post(URL, json=order_lookup("Orders B")).status_code == 201
    assert client.post(URL, json=order_lookup("orders b")).status_code == 409


def test_invalid_url_rejected() -> None:
    bad = order_lookup("Bad URL") | {"url": "not-a-url"}
    assert client.post(URL, json=bad).status_code == 422


def test_api_key_auth_requires_key() -> None:
    bad = order_lookup("No key") | {"auth": {"type": "api_key"}}
    assert client.post(URL, json=bad).status_code == 422


def test_tools_must_be_valid_and_unique() -> None:
    empty = order_lookup("No tools") | {"allowed_tools": []}
    dupes = order_lookup("Dupes") | {"allowed_tools": ["get_order", "get_order"]}
    spaces = order_lookup("Spaces") | {"allowed_tools": ["get order"]}
    for bad in (empty, dupes, spaces):
        assert client.post(URL, json=bad).status_code == 422


def test_delete_and_missing() -> None:
    server_id = client.post(URL, json=order_lookup("Orders C")).json()["id"]
    assert client.delete(f"{URL}/{server_id}").status_code == 204
    assert client.get(f"{URL}/{server_id}").status_code == 404
    assert client.delete(f"{URL}/{server_id}").status_code == 404
