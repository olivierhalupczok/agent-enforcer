#!/usr/bin/env bash
# Vercel build step for the API project (bash build.sh).
# 1. Export uv.lock to requirements.txt (the Vercel Python runtime installs
#    requirements.txt natively). uv may not exist on the build image; if the
#    export cannot run, fall back to the committed requirements.txt.
# 2. Install the pi coding agent (npm) into a trimmed node_modules so the
#    playground runner can spawn it from a serverless function:
#    - 250MB lambda limit: drop esbuild (284MB, build tooling only) + typescript
#    - runtime deps stay: cli.js + provider SDKs (~167MB)
# 3. Vendor the control-layer extension, schema and seed policy into the
#    project dir (works with repo layout and standalone uploads).
set -euo pipefail
cd "$(dirname "$0")"
echo "==> build.sh: pwd=$(pwd)"

echo "==> [1/3] python requirements"
REQ_SRC=""
if command -v uv >/dev/null 2>&1; then
  echo "    uv found: $(uv --version)"
  if uv export --no-dev --format requirements.txt --output-file requirements.txt 2>&1; then
    REQ_SRC="uv export"
  else
    echo "    uv export failed; falling back"
  fi
else
  echo "    uv not on PATH"
fi
if [ -z "$REQ_SRC" ]; then
  # fallback: committed requirements.txt (from `uv export`, checked in) or empty stub
  if [ -f requirements.txt ]; then
    echo "    using committed requirements.txt"
    REQ_SRC="committed"
  else
    echo "    WARNING: no requirements.txt available — python deps rely on runtime detection"
    REQ_SRC="none"
  fi
fi
echo "    requirements source: $REQ_SRC ($(wc -l < requirements.txt 2>/dev/null || echo 0) lines)"

echo "==> [2/3] npm install pi coding agent"
export NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
npm install @earendil-works/pi-coding-agent@0.85.1 --prefix . --no-save --loglevel=error
PKG="node_modules/@earendil-works/pi-coding-agent"
echo "    node_modules (pre-trim): $(du -sh node_modules 2>/dev/null | cut -f1 || echo '?')"

# copy the trimmed package next to the function file: the Python runtime always
# ships files that sit inside the function's directory, no includeFiles needed
echo "==> [2b] vendor pi (single-file bundle) + node binary into api/_pi/"
# Vercel's Python builder prunes nested node_modules/ dirs even when listed in
# includeFiles, so the package must be self-contained: esbuild-inlines
# @earendil-works/chord + typebox into dist/bundle/cli.js itself. No node_modules.
rm -rf api/_pi
mkdir -p api/_pi/pi-coding-agent
# pick the esbuild binary matching this machine (nested in the pi package,
# which ships binaries for many platforms; only this platform's will execute)
ESBUILD=""
for cand in "$PKG"/node_modules/@esbuild/*/bin/esbuild; do
  if "$cand" --version >/dev/null 2>&1; then ESBUILD="$cand"; break; fi
done
if [ -z "$ESBUILD" ]; then echo "    ERROR: working esbuild binary not found"; exit 1; fi
echo "    esbuild: $(basename "$(dirname "$(dirname "$(dirname "$ESBUILD")")")") ($("$ESBUILD" --version))"
cp -R "$PKG/dist" api/_pi/pi-coding-agent/dist
# package.json: pi's getPackageDir() walks up to find it (themes, assets);
# PI_PACKAGE_DIR env (set by the runner) pins it regardless
cp "$PKG/package.json" api/_pi/pi-coding-agent/package.json
# jiti: the extension loader require()s it at runtime; it has no deps of its own
mkdir -p api/_pi/pi-coding-agent/node_modules
cp -R "$PKG/node_modules/jiti" api/_pi/pi-coding-agent/node_modules/jiti
"$ESBUILD" "$PKG/dist/bundle/cli.js" --bundle --platform=node --format=esm \
  --outfile=api/_pi/pi-coding-agent/dist/bundle/cli.js 2>&1 | tail -1
# drop the chunk files the single-file bundle replaces (keep dist/modes etc.)
rm -rf api/_pi/pi-coding-agent/dist/bundle/chunks
echo "    vendored cli.js: $(du -h api/_pi/pi-coding-agent/dist/bundle/cli.js | cut -f1)"
echo "    api/_pi: $(du -sh api/_pi 2>/dev/null | cut -f1 || echo '?')"

# the runtime lambda has no node on PATH (python runtime) — ship the build
# image's node binary; the launcher prefers it via PI_COMMAND (state.py)
NODE_BIN="$(command -v node || true)"
if [ -n "$NODE_BIN" ]; then
  cp "$NODE_BIN" api/_pi/node
  chmod +x api/_pi/node
  echo "    shipped node: $(api/_pi/node --version)"
else
  echo "    WARNING: no node on build image PATH; runtime pi spawn will fail"
fi
# verify the vendored stack end to end
if [ -x api/_pi/node ]; then
  ANTHROPIC_API_KEY=dummy api/_pi/node api/_pi/pi-coding-agent/dist/bundle/cli.js --provider anthropic --model claude-sonnet-4-5 --version >/dev/null 2>&1 \
    && echo "    vendored single-file pi runs OK" || echo "    WARNING: vendored pi did not run"
fi
echo "    node_modules after trim: kept (needed for the extension compile below)"

echo "==> [3/3] vendor pi-control-layer files"
# locate the package either as repo sibling (repo layout) or already vendored
SRC=""
for cand in ../packages/pi-control-layer packages/pi-control-layer ../../packages/pi-control-layer; do
  if [ -f "$cand/control-layer.ts" ]; then SRC="$cand"; break; fi
done
if [ -z "$SRC" ]; then echo "    ERROR: control-layer.ts not found in any candidate location"; ls -la; exit 1; fi
echo "    source: $SRC"
mkdir -p pi-control-layer
cp "$SRC/policy.schema.json" pi-control-layer/
cp "$SRC/policy.json.example" pi-control-layer/
# compile the extension to .mjs: pi loads .ts via jiti (pruned from the lambda)
# but .mjs via plain import — no jiti needed
"$ESBUILD" "$SRC/control-layer.ts" --bundle --platform=node --format=esm \
  --outfile=pi-control-layer/control-layer.mjs 2>&1 | tail -1
ls pi-control-layer/
# node_modules is only build tooling — remove it AFTER the extension compile
rm -rf node_modules package-lock.json
echo "==> build.sh complete"
