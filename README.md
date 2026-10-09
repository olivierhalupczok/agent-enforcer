# Agent Enforcer

See for yourself:  
https://hackyeah-2026-theta.vercel.app/agents

Landing page:  
https://hackyeah-2026-c3ff.vercel.app/#how

Quick guardrails showcase:  
https://github.com/user-attachments/assets/ee1e1934-8652-417a-a219-bddbe61ccb2c


AI Control Layer: put guardrails in front of any A2A agent, watch every rule fire live, and change them without redeploying the agent.

## Tutorial

Try it on the [live app](https://hackyeah-2026-theta.vercel.app) or [run it locally](#first-time-setup). Each agent has its own workspace that walks you through setup.

| #   | Go to                                   | Do this                                                                          |
| --- | --------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | **Agents** → **Register agent**         | Paste an A2A agent URL. The hub reads its Agent Card and opens the agent's setup |
| 2   | Agent → **Guardrails**                  | Attach checks from the library (PII, injection, topics…) and order them          |
| 3   | Agent → **MCP tools** (optional)        | Grant tool servers and pick which tools the agent may call                       |
| 4   | Agent → **Test**                        | Send a message or a scenario through the guarded pipeline and read the trace     |
| 5   | Agent → **Go live**                     | Create a gateway key and copy the guarded URL                                     |
| 6   | Agent → **Activity**, **Audit log**, **Security** | See sessions and every block or redaction, or **Run scan** to probe the agent |

| Path               | What it is                            | Tooling                 |
| ------------------ | ------------------------------------- | ----------------------- |
| `apps/api`         | Backend API (FastAPI)                 | Python, standalone uv   |
| `apps/web`         | Control panel UI (React + Vite + TS)  | Node, pnpm              |
| `apps/landing`     | Marketing landing page (Astro)        | Node, pnpm              |
| `apps/cli`         | Command-line tool (Typer)             | Python, uv workspace    |
| `apps/agents`      | Demo A2A agents                       | Python, standalone      |
| `apps/test-agent`  | Deterministic A2A test agent          | Python, uv workspace    |
| `packages/core`    | Shared Python code for API and CLI    | Python, uv workspace    |

The panel's sidebar has **Agents** (each agent's setup and activity), a **Library** (guardrails and MCP servers shared by all agents) and **Monitor** pages (sessions, audit log, security scan across all agents).

## Prerequisites

Install once (Linux, macOS or WSL):

| Tool    | Version | Install                                                         |
| ------- | ------- | --------------------------------------------------------------- |
| git     | any     | `sudo apt install git`                                          |
| uv      | any  | `curl -LsSf https://astral.sh/uv/install.sh \| sh`              |
| Node.js | 22+     | via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`       |
| pnpm    | 12.8.1  | `corepack enable` (pinned in `apps/web/package.json`)            |
| make    | any     | `sudo apt install make` (or use `just`, see below)               |

You do not need to install Python yourself: uv downloads the version pinned in `.python-version` (3.12) automatically.

## First-time setup

```bash
git clone <repo-url>
cd hackyeah-2026

make install                 # installs all Python and web dependencies
uv run pre-commit install    # runs ruff automatically on every commit
```

## Running the demo locally

Two terminals from the repo root:

```bash
make api        # API on :8000, auto-reload
make web        # panel on :5173
```

Open http://localhost:5173 and follow the [tutorial](#tutorial).

The agents pages need a Supabase database:

```bash
make supabase        # start local Supabase, apply migrations, write env files
make supabase-stop   # stop it (data kept in Docker volumes)
```

## Make targets

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `make api`          | API on :8000 with auto-reload                   |
| `make web`          | Vite dev server on :5173                        |
| `make landing`      | Astro landing page on :4321                     |
| `make cli`          | CLI help (`uv run acme`)                        |
| `make test-agent`   | Deterministic A2A test agent                    |
| `make lint`         | ruff lint + format check + mypy                 |
| `make test`         | pytest (root workspace + API project)           |
| `make supabase`     | Local Supabase + env files                      |
| `make supabase-stop`| Stop local Supabase                             |

If you prefer [just](https://github.com/casey/just), a `justfile` with the same commands sits next to the Makefile (`just api`, `just web`, ...).

All Python code shares one `uv.lock` and one `.venv` at the repo root, except the API which is a standalone uv project (`apps/api`). The web app and landing page are pnpm projects.

## Day-to-day workflow

### Adding dependencies

```bash
uv add --package acme-cli <pkg>     # CLI only (workspace)
uv add --package acme-core <pkg>    # shared library (workspace)
uv add --dev <pkg>                  # dev tooling, repo root
cd apps/api && uv add <pkg>         # API (standalone project)
```

```bash
cd apps/web
pnpm add <pkg>                      # runtime dependency
pnpm add -D <pkg>                   # dev dependency
```

Commit lockfiles (`uv.lock`, `pnpm-lock.yaml`) together with the manifest changes. CI installs with `--frozen-lockfile` and fails when they drift.

### Before you push

```bash
make lint
make test
cd apps/web && pnpm lint && pnpm build
```

## Deployment

The whole app deploys as one Vercel project using [Services](https://vercel.com/docs/services), configured in the root `vercel.json` (leave the project's Root Directory empty). On one domain, `/` is the landing page, `/api/*` and the `/a/*` gateway go to the API, and every other path is the web panel. The API's build step exports `uv.lock` to `requirements.txt`. Environment variables: `SUPABASE_URL` and `SUPABASE_KEY` (API and web build; the web key must be the publishable one) and `ANTHROPIC_API_KEY` (model access for the judge engine).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request: Python lint, format check, mypy and pytest; web lint and production build. Both must be green before merging.
