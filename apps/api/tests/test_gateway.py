"""B-01 gateway: routing, key check, unchanged forwarding, buffered streaming."""

import json
from collections.abc import AsyncIterator, Callable, Iterator
from unittest.mock import MagicMock

import httpx
import pytest
from app.api.routes.agents.deps import AgentDatabase, ResolvedUpstream, get_agent_database
from app.gateway import router as gateway_router
from app.gateway.keys import KEY_PREFIX, hash_key
from app.gateway.resolver import SupabaseAgentResolver, UpstreamTarget, get_agent_resolver
from app.main import app
from fastapi.testclient import TestClient
from pydantic import HttpUrl

client = TestClient(app)

AGENT_ID = "7b4eb987-4315-4745-83c7-258061f2f2c4"
GOOD_KEY = "gk_test_key"
CHAT = {"messages": [{"role": "user", "content": "Where is my order #48213?"}]}
DEMO_REPLY = {"reply": "Your order #48213 shipped on 2 October.", "model": "mock"}


class FakeResolver:
    def __init__(self, target: UpstreamTarget | None) -> None:
        self.target = target
        self.calls: list[tuple[str, str]] = []

    def resolve(self, agent_id: str, key: str) -> UpstreamTarget | None:
        self.calls.append((agent_id, key))
        return self.target if key == GOOD_KEY else None


DEMO = UpstreamTarget(
    upstream_url="https://agent.example.com/chat",
    auth_header_name="Authorization",
    auth_header_value="Bearer upstream-secret",
)


def _upstream(handler: Callable[[httpx.Request], httpx.Response]) -> None:
    async def override() -> AsyncIterator[httpx.AsyncClient]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
            yield http_client

    app.dependency_overrides[gateway_router.get_gateway_http_client] = override


@pytest.fixture(autouse=True)
def setup(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeResolver]:
    async def allow_test_upstream(url: HttpUrl) -> ResolvedUpstream:
        original = httpx.URL(str(url))
        return ResolvedUpstream(
            url=original.copy_with(host="93.184.216.34"),
            host_header=original.netloc.decode("ascii"),
            sni_hostname=original.host,
        )

    monkeypatch.setattr(gateway_router, "ensure_public_upstream", allow_test_upstream)
    resolver = FakeResolver(DEMO)
    app.dependency_overrides[get_agent_resolver] = lambda: resolver
    yield resolver
    app.dependency_overrides.clear()


def post(key: str | None = GOOD_KEY, agent_id: str = AGENT_ID) -> httpx.Response:
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    return client.post(f"/a/{agent_id}", json=CHAT, headers=headers)


def test_demo_agent_answers_unchanged_through_the_gateway() -> None:
    seen: dict[str, object] = {}

    def demo_agent(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["host"] = request.headers["host"]
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=DEMO_REPLY)

    _upstream(demo_agent)
    r = post()

    assert r.status_code == 200
    assert r.json() == DEMO_REPLY
    assert seen == {
        "path": "/chat",
        "host": "agent.example.com",
        "auth": "Bearer upstream-secret",  # the agent's own key, not the caller's gateway key
        "body": CHAT,
    }


def test_missing_key_is_401() -> None:
    r = post(key=None)
    assert r.status_code == 401
    assert r.json() == {"detail": "Invalid or missing gateway key"}


def test_wrong_key_is_401(setup: FakeResolver) -> None:
    assert post(key="gk_wrong").status_code == 401
    assert setup.calls == [(AGENT_ID, "gk_wrong")]


def test_unknown_agent_is_401_like_a_wrong_key(setup: FakeResolver) -> None:
    setup.target = None
    assert post().status_code == 401
    assert post(agent_id="not-a-uuid").status_code == 401


def test_streamed_reply_is_buffered_in_full() -> None:
    chunks = [b'{"reply": "Your order ', b"#48213 shipped ", b'on 2 October.", "model": "mock"}']

    def streaming_agent(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            stream=httpx.ByteStream(b"".join(chunks)),
        )

    class ChunkedStream(httpx.AsyncByteStream):
        async def __aiter__(self) -> AsyncIterator[bytes]:
            for chunk in chunks:
                yield chunk

    def chunked_agent(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, headers={"content-type": "application/json"}, stream=ChunkedStream()
        )

    for handler in (streaming_agent, chunked_agent):
        _upstream(handler)
        r = post()
        assert r.status_code == 200
        assert r.json() == DEMO_REPLY


def test_upstream_errors_are_passed_through() -> None:
    _upstream(
        lambda _r: httpx.Response(400, json={"detail": "The last message must come from the user"})
    )
    r = post()
    assert r.status_code == 400
    assert r.json() == {"detail": "The last message must come from the user"}


def test_unreachable_upstream_is_502() -> None:
    def down(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    _upstream(down)
    assert post().status_code == 502


def test_slow_upstream_is_504() -> None:
    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    _upstream(slow)
    assert post().status_code == 504


def test_supabase_resolver_sends_only_the_key_hash() -> None:
    database = MagicMock()
    database.rpc.return_value.execute.return_value.data = [
        {
            "upstream_url": "https://agent.example.com/chat",
            "auth_header_name": None,
            "auth_header_value": None,
        }
    ]

    target = SupabaseAgentResolver(database).resolve(AGENT_ID, GOOD_KEY)

    assert target == UpstreamTarget(upstream_url="https://agent.example.com/chat")
    database.rpc.assert_called_once_with(
        "gateway_resolve_agent", {"p_agent_id": AGENT_ID, "p_key_hash": hash_key(GOOD_KEY)}
    )

    database.rpc.return_value.execute.return_value.data = []
    assert SupabaseAgentResolver(database).resolve(AGENT_ID, "gk_wrong") is None


def test_owner_creates_a_gateway_key_and_only_its_hash_is_stored() -> None:
    database = MagicMock()
    query = database.table.return_value.update.return_value.eq.return_value
    query.execute.return_value.data = [{"id": AGENT_ID}]
    app.dependency_overrides[get_agent_database] = lambda: AgentDatabase(
        client=database, owner_id="971f4031-2dd9-4327-94c7-45323de61c67"
    )

    r = client.post(f"/api/v1/agents/{AGENT_ID}/gateway-key")

    assert r.status_code == 201
    body = r.json()
    assert body["key"].startswith(KEY_PREFIX)
    assert body["gateway_path"] == f"/a/{AGENT_ID}"
    stored = database.table.return_value.update.call_args.args[0]
    assert stored == {"gateway_key_hash": hash_key(body["key"])}
    database.table.return_value.update.return_value.eq.assert_called_once_with("id", AGENT_ID)


def test_gateway_key_for_someone_elses_agent_is_404() -> None:
    database = MagicMock()
    database.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
    app.dependency_overrides[get_agent_database] = lambda: AgentDatabase(
        client=database, owner_id="971f4031-2dd9-4327-94c7-45323de61c67"
    )
    assert client.post(f"/api/v1/agents/{AGENT_ID}/gateway-key").status_code == 404
