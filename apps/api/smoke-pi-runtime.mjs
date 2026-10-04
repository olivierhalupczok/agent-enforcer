// Run after build.sh removes build dependencies. No provider request is made.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(process.argv[2] ?? fileURLToPath(new URL(".", import.meta.url)));
const sandbox = mkdtempSync(join(tmpdir(), "pi-runtime-smoke-"));
try {
  // Match Python-function pruning and prevent local dependencies/configuration
  // from masking a broken deployment artifact.
  const runtime = join(sandbox, "_pi");
  cpSync(join(apiRoot, "api", "_pi"), runtime, {
    recursive: true,
    filter: (source) => basename(source) !== "node_modules",
  });
  const extension = join(sandbox, "control-layer.mjs");
  cpSync(join(apiRoot, "pi-control-layer", "control-layer.mjs"), extension);
  const pkg = join(runtime, "pi-coding-agent");
  const result = spawnSync(join(runtime, "node"), [
    join(pkg, "dist", "bundle", "cli.js"),
    "--mode", "rpc", "--no-session",
    "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes",
    "--provider", "anthropic", "--model", "claude-sonnet-4-5",
    "-e", extension,
  ], {
    cwd: sandbox,
    env: {
      PATH: process.env.PATH,
      HOME: sandbox,
      PI_CODING_AGENT_DIR: join(sandbox, "agent"),
      PI_PACKAGE_DIR: pkg,
      NODE_PATH: join(runtime, "runtime-deps"),
      // A missing policy is fine for a loader-only test; no websocket is opened.
      POLICY_PATH: join(sandbox, "missing-policy.json"),
      ANTHROPIC_API_KEY: "smoke-test-no-network",
    },
    input: '{"id":"smoke","type":"get_commands"}\n',
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Pi failed:\n${result.stderr}\n${result.stdout}`);
  assert.doesNotMatch(result.stderr, /Failed to load extension/);
  const messages = result.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const response = messages.find((message) => message.id === "smoke");
  assert.ok(response?.success, `get_commands failed:\n${result.stdout}\n${result.stderr}`);
  assert.ok(
    response.data.commands.some((command) => command.name === "ctl-reload"),
    "Control-layer extension did not register ctl-reload",
  );
  console.log("    vendored pi loads control-layer OK (no node_modules, no LLM request)");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
