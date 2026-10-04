"""Reading the pi control layer's incident file (.pi/incidents.json).

The extension appends one JSON object per detected prompt injection; the app
exposes them read-only on /api/v1/pi/incidents. Auto-ban rules it wrote into
the live policy are surfaced per incident as a badge.
"""

import json
import os
import threading
from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path

from app.core.config import settings
from app.pi_policy.service import PolicyFileService, get_policy_service


@dataclass(frozen=True)
class Incident:
    ts: str
    agent: str
    source: str
    hits: list[str]
    mode: str
    detail: str
    url: str | None
    autoBanned: bool = field(default=False)  # noqa: N815 (mirrors the JSON payload keys)

    def as_dict(self) -> dict[str, object]:
        return {
            "ts": self.ts,
            "agent": self.agent,
            "source": self.source,
            "hits": self.hits,
            "mode": self.mode,
            "detail": self.detail,
            "url": self.url,
            "autoBanned": self.autoBanned,
        }


def read_incidents() -> list[dict[str, object]]:
    """Incidents, newest first, each annotated with its auto-ban status."""
    path = Path(settings.INCIDENTS_PATH)
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if not isinstance(raw, list):
        return []

    banned_urls = _auto_banned_urls()
    incidents: list[dict[str, object]] = []
    for entry in reversed(raw):  # newest first
        if not isinstance(entry, dict):
            continue
        incident = Incident(
            ts=str(entry.get("ts", "")),
            agent=str(entry.get("agent", "")),
            source=str(entry.get("source", "")),
            hits=[str(h) for h in (entry.get("hits") or [])],
            mode=str(entry.get("mode", "warn")),
            detail=str(entry.get("detail", "")),
            url=entry.get("url") if isinstance(entry.get("url"), str) else None,
        )
        incident.autoBanned = bool(incident.url and incident.url in banned_urls)
        incidents.append(incident.as_dict())
    return incidents


def _auto_banned_urls() -> set[str]:
    """URLs currently covered by an auto-ban-* rule in the live policy."""
    try:
        policy, _ = get_policy_service().read()
    except Exception:  # noqa: BLE001 — a broken policy file must not break the incidents view
        return set()
    urls: set[str] = set()
    for agent_policy in (policy.get("agents") or {}).values():
        if not isinstance(agent_policy, dict):
            continue
        commands = agent_policy.get("commands") or {}
        for rule in commands.get("banned") or []:
            if isinstance(rule, dict) and str(rule.get("id", "")).startswith("auto-ban-"):
                pattern = str(rule.get("pattern", ""))
                urls.add(pattern.strip("*"))
    return urls


def ban_url(url: str, service: PolicyFileService | None = None) -> dict[str, object]:
    """Human-in-the-loop variant: ban a URL through the validated policy writer."""
    svc = service or get_policy_service()
    policy, _ = svc.read()
    rule_id = f"auto-ban-{_hash(url)}"

    with _policy_write_lock:
        agents: dict[str, dict] = policy.setdefault("agents", {})
        host_policy: dict = agents.setdefault(_demo_host(), {})
        commands: dict = host_policy.setdefault("commands", {})
        banned: list[dict] = list(commands.get("banned") or [])
        if not any(r.get("id") == rule_id for r in banned):
            banned.append(
                {
                    "id": rule_id,
                    "pattern": f"*{url}*",
                    "reason": "Manually banned after incident review",
                    "enabled": True,
                }
            )
            commands["banned"] = banned
        svc.write(policy)
    return {"ruleId": rule_id, "url": url}


def unban_url(url: str, service: PolicyFileService | None = None) -> dict[str, object]:
    """Remove every auto-ban rule matching this URL from every host."""
    svc = service or get_policy_service()
    rule_id = f"auto-ban-{_hash(url)}"
    policy, _ = svc.read()
    removed = 0
    for agent_policy in (policy.get("agents") or {}).values():
        if not isinstance(agent_policy, dict):
            continue
        commands = agent_policy.get("commands") or {}
        banned = commands.get("banned") or []
        kept = [r for r in banned if r.get("id") != rule_id]
        if len(kept) != len(banned):
            removed += len(banned) - len(kept)
            if kept:
                commands["banned"] = kept
            else:
                commands.pop("banned", None)
    if removed:
        svc.write(policy)
    return {"ruleId": rule_id, "removed": removed}


_policy_write_lock = threading.Lock()


def _hash(url: str) -> str:
    return sha256(url.encode()).hexdigest()[:8]


def _demo_host() -> str:
    """The host the manual ban applies to (PI_DEMO_HOST when set, else 'manual-bans')."""
    return os.environ.get("PI_DEMO_HOST", "manual-bans")
