# Profilo — local development. Requires only Docker and make.
COMPOSE := docker compose
API_RUN := $(COMPOSE) run --rm api
API_RUN_NODEPS := $(COMPOSE) run --rm --no-deps api
API_TEST_RUN := $(COMPOSE) run --rm -e ENVIRONMENT=test api
CLIENT_RUN := $(COMPOSE) run --rm --no-deps client

.DEFAULT_GOAL := help
.PHONY: help env up down logs migrate seed test test-api test-client lint lint-api lint-client format check api-shell hooks

help: ## Show available commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

up: env ## Build and start everything, run migrations and seed (http://localhost:8080)
	$(COMPOSE) up -d --build --wait
	$(MAKE) migrate seed
	@echo "Profilo: http://localhost:8080  ·  Mailpit: http://localhost:8025"

down: ## Stop all containers
	$(COMPOSE) down

logs: ## Follow logs of all services
	$(COMPOSE) logs -f --tail=100

migrate: env ## Apply database migrations
	$(COMPOSE) exec -T api alembic upgrade head

seed: ## Load demo data (none yet; added with the first features)
	@echo "No demo data yet."

test: test-api test-client ## Run all tests with coverage

test-api: env
	$(COMPOSE) up -d --wait db valkey
	$(API_TEST_RUN) sh -c 'export DATABASE_URL=$$TEST_DATABASE_URL && alembic upgrade head && pytest --cov --cov-report=term-missing'

test-client: env
	$(CLIENT_RUN) npm test

lint: lint-api lint-client ## Run formatters in check mode, linters and type checks

lint-api: env
	$(API_RUN_NODEPS) sh -c 'ruff format --check . && ruff check . && mypy .'

lint-client: env
	$(CLIENT_RUN) sh -c 'npm run format:check && npm run lint && npm run typecheck'

format: env ## Format code (api: ruff, client: prettier)
	$(API_RUN_NODEPS) sh -c 'ruff format . && ruff check --fix .'
	$(CLIENT_RUN) npm run format

check: lint test ## All checks required in CI

api-shell: env ## Shell in the api container
	$(API_RUN) bash

hooks: ## Install git hooks (gitleaks secret scan before each commit)
	git config core.hooksPath .githooks
	@echo "Git hooks installed from .githooks/"
