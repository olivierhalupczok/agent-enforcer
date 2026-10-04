"""Reading the pi control layer's incident file (.pi/incidents.json).

The extension appends one JSON object per negative policy event (blocks,
denials, injections, auto-bans, redactions, limit breaches); the app exposes
them read-only on /api/v1/pi/incidents. Auto-ban rules it wrote into the live
policy are surfaced per incident as a badge.
"""

import json
import threading
from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path

from app.core.config import settings
from app.pi_policy.service import PolicyFileService, get_policy_service

_policy_write_lock = threading.Lock()


@dataclass(frozen=True)
class Incident:
    ts: str
    agent: str
    event: str
    scope: str  # "defaults" (global config) or the host the rule came from
    hits: list[str]
    mode: str
    tool: str | None
    detail: str
    url: str | None
    autoBanned: bool = field(default=False)  # noqa: N815 (mirrors the JSON payload keys)

    def as_dict(self) -> dict[str, object]:
        return {
            "ts": self.ts,
            "agent": self.agent,
            "event": self.event,
            "scope": self.scope,
            "hits": self.hits,
            "mode": self.mode,
            "tool": self.tool,
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
        url = entry.get("url") if isinstance(entry.get("url"), str) else None
        incident = Incident(
            ts=str(entry.get("ts", "")),
            agent=str(entry.get("agent", "")),
            event=str(entry.get("event", entry.get("type", "unknown"))),
            scope=str(entry.get("scope", "defaults")),
            hits=[str(h) for h in (entry.get("hits") or [])],
            mode=str(entry.get("mode", "block")),
            tool=entry.get("tool") if isinstance(entry.get("tool"), str) else None,
            detail=str(entry.get("detail", "")),
            url=url,
            autoBanned=bool(url) and url in banned_urls,
        )
        incidents.append(incident.as_dict())
    return incidents


def _auto_banned_urls() -> set[str]:
    """URLs currently covered by an auto-ban-* rule in the live policy."""
    try:
        policy, _ = get_policy_service().read()
    except Exception:  # noqa: BLE001 — a broken policy file must not break the incidents view
        return set()
    urls: set[str] = set()
    # auto-ban lives in defaults.blockedLinks (global); per-host lists and the
    # legacy commands.banned spot are also scanned for older policies
    scopes: list[dict] = [policy.get("defaults") or {}]
    scopes += [ap for ap in (policy.get("agents") or {}).values() if isinstance(ap, dict)]
    for agent_policy in scopes:
        rules = list(agent_policy.get("blockedLinks") or [])
        commands = agent_policy.get("commands") or {}
        rules += commands.get("banned") or []
        for rule in rules:
            if isinstance(rule, dict) and str(rule.get("id", "")).startswith("auto-ban-"):
                pattern = str(rule.get("pattern", ""))
                urls.add(pattern.strip("*").removesuffix("*"))
    return urls


def ban_url(url: str, service: PolicyFileService | None = None) -> dict[str, object]:
    """Human-in-the-loop variant: ban a URL in the global config through the policy writer."""
    svc = service or get_policy_service()
    policy, _ = svc.read()
    rule_id = f"auto-ban-{_hash(url)}"

    with _policy_write_lock:
        defaults: dict = policy.setdefault("defaults", {})
        blocked: list[dict] = list(defaults.get("blockedLinks") or [])
        if not any(r.get("id") == rule_id for r in blocked):
            blocked.append(
                {
                    "id": rule_id,
                    "pattern": f"{url}*",
                    "reason": "Manually banned after incident review",
                    "enabled": True,
                }
            )
            defaults["blockedLinks"] = blocked
        svc.write(policy)
    return {"ruleId": rule_id, "url": url}


def unban_url(url: str, service: PolicyFileService | None = None) -> dict[str, object]:
    """Remove every auto-ban rule matching this URL from every scope."""
    svc = service or get_policy_service()
    rule_id = f"auto-ban-{_hash(url)}"
    policy, _ = svc.read()
    removed = 0
    scopes: list[dict] = []
    if isinstance(policy.get("defaults"), dict):
        scopes.append(policy["defaults"])
    scopes += [ap for ap in (policy.get("agents") or {}).values() if isinstance(ap, dict)]
    for scope_policy in scopes:
        rules = list(scope_policy.get("blockedLinks") or [])
        kept = [r for r in rules if r.get("id") != rule_id]
        if len(kept) != len(rules):
            removed += len(rules) - len(kept)
            if kept:
                scope_policy["blockedLinks"] = kept
            else:
                scope_policy.pop("blockedLinks", None)
    if removed:
        svc.write(policy)
    return {"ruleId": rule_id, "removed": removed}


def _hash(url: str) -> str:
    return sha256(url.encode()).hexdigest()[:8]
