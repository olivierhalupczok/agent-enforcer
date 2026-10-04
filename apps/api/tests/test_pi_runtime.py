import os
import shutil
import subprocess
from pathlib import Path

import pytest
from app.pi_policy import state

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("existing", [None, "/custom/modules"])
def test_pi_env_exposes_vendored_dependencies(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, existing: str | None
) -> None:
    pkg = tmp_path / "pi-coding-agent"
    cli = pkg / "dist" / "bundle" / "cli.js"
    cli.parent.mkdir(parents=True)
    cli.touch()
    deps = tmp_path / "runtime-deps"
    deps.mkdir()
    monkeypatch.setattr(state, "_PI_NPM_CANDIDATES", (pkg,))
    if existing is None:
        monkeypatch.delenv("NODE_PATH", raising=False)
    else:
        monkeypatch.setenv("NODE_PATH", existing)

    env = state.pi_env()

    assert env["PI_PACKAGE_DIR"] == str(pkg)
    assert env["NODE_PATH"].split(os.pathsep) == [str(deps), *([existing] if existing else [])]


def test_pi_env_without_vendored_dependencies(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(state, "_PI_NPM_CANDIDATES", (tmp_path,))
    monkeypatch.setenv("NODE_PATH", "/custom/modules")
    assert "NODE_PATH" not in state.pi_env()


def test_built_pi_loads_extension_without_node_modules() -> None:
    """Exercise the real artifact when built; build.sh also runs this smoke check."""
    if not (API_ROOT / "api" / "_pi" / "node").is_file():
        pytest.skip("Run apps/api/build.sh to produce the vendored runtime")
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node is required for the deployment smoke test")
    result = subprocess.run(
        [node, str(API_ROOT / "smoke-pi-runtime.mjs")],
        capture_output=True,
        text=True,
        timeout=45,
    )
    assert result.returncode == 0, result.stdout + result.stderr
