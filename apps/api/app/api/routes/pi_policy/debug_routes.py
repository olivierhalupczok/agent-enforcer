"""Runtime diagnostics for the pi integration (tag: pi-debug).

Answers the "is pi actually in this lambda and where" question in one request:
what the runner looks for, what exists on disk, and whether node/pi are usable.
Remove when deployment is stable.
"""

import contextlib
import os
import shutil

from fastapi import APIRouter

from app.core.config import settings
from app.pi_policy.state import _PI_NPM_CANDIDATES, pi_command, pi_env

router = APIRouter(prefix="/pi/debug", tags=["pi-debug"])


def _du(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            with contextlib.suppress(OSError):
                total += os.path.getsize(os.path.join(root, f))
    return total


@router.get("")
def debug_pi() -> dict[str, object]:
    task = "/var/task"
    task_listing = sorted(os.listdir(task))[:30] if os.path.isdir(task) else None

    probes: dict[str, object] = {}
    for candidate in _PI_NPM_CANDIDATES:
        pkg = str(candidate)
        dist = os.path.join(pkg, "dist")
        probes[pkg] = {
            "pkgDir": os.path.isdir(pkg),
            "cliJs": os.path.isfile(os.path.join(pkg, "dist", "bundle", "cli.js")),
            "distListing": sorted(os.listdir(dist))[:10] if os.path.isdir(dist) else None,
            "pkgSizeBytes": _du(pkg) if os.path.isdir(pkg) else 0,
        }

    return {
        "cwd": os.getcwd(),
        "vercel": bool(os.environ.get("VERCEL")),
        "varTaskListing": task_listing,
        "repoRoot": settings.REPO_ROOT,
        "nodeOnPath": shutil.which("node"),
        "piOnPath": shutil.which("pi"),
        "resolvedPiCommand": pi_command(),
        "piEnv": pi_env(),
        "candidateProbes": probes,
    }
