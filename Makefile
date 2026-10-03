.PHONY: install api web cli lint test

install:
	uv sync --all-packages
	cd apps/web && pnpm install

api:
	uv run --package acme-api uvicorn acme_api.main:app --reload --port 8000

web:
	cd apps/web && pnpm dev

cli:
	uv run acme --help

lint:
	uv run ruff check . && uv run ruff format --check . && uv run mypy apps packages

test:
	uv run pytest