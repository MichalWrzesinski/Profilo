# Profilo — local development and CI. Requires only Docker and make.
COMPOSE := docker compose
# Checks run as the host user so files written into bind mounts (coverage, caches) are
# owned by the caller — required on Linux hosts and CI runners.
AS_HOST := --user $(shell id -u):$(shell id -g) -e HOME=/tmp
API_RUN := $(COMPOSE) run --rm $(AS_HOST) api
API_RUN_NODEPS := $(COMPOSE) run --rm --no-deps $(AS_HOST) api
API_TEST_RUN := $(COMPOSE) run --rm $(AS_HOST) -e ENVIRONMENT=test -e VALKEY_URL=redis://valkey:6379/1 -e MEDIA_URL=memory://media api
CLIENT_RUN := $(COMPOSE) run --rm --no-deps $(AS_HOST) client

.DEFAULT_GOAL := help
.PHONY: help env up down logs migrate seed test test-api test-client lint lint-api lint-client \
	format contract check audit secrets images ci e2e api-shell hooks

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

test: test-api test-client ## Run all tests with coverage (threshold 95 %)

test-api: env
	$(COMPOSE) up -d --wait db valkey
	$(API_TEST_RUN) sh -c 'export DATABASE_URL=$$TEST_DATABASE_URL && alembic upgrade head && pytest --cov --cov-report=term-missing'

test-client: env
	$(CLIENT_RUN) npm test

lint: lint-api lint-client ## Run formatters in check mode, linters and type checks

lint-api: env
	$(API_RUN_NODEPS) sh -c 'ruff format --check . && ruff check . && mypy .'

lint-client: env
	$(CLIENT_RUN) sh -c 'npm run format:check && npm run lint && npm run typecheck && npm run api:check'

format: env ## Format code (api: ruff, client: prettier)
	$(API_RUN_NODEPS) sh -c 'ruff format . && ruff check --fix .'
	$(CLIENT_RUN) npm run format

contract: env ## Check the API against docs/api/openapi.yaml
	$(API_RUN_NODEPS) python -m scripts.check_contract

check: lint test contract ## Formatters, linters, type checks, tests with coverage, API contract

audit: env ## Known vulnerabilities: fails on runtime deps and on high/critical dev deps
	$(API_RUN_NODEPS) sh -c 'uv export --frozen --no-dev --no-emit-project --quiet -o /tmp/requirements.txt && pip-audit --strict --disable-pip --require-hashes -r /tmp/requirements.txt'
	$(CLIENT_RUN) npm audit --omit=dev --audit-level=low
	$(CLIENT_RUN) npm audit --audit-level=high

secrets: ## Scan the whole git history for secrets (gitleaks)
	$(COMPOSE) run --rm --no-deps gitleaks git --redact --no-banner /repo

images: ## Build production images (api, client)
	docker build --target prod -t profilo-api:prod api
	docker build --target prod -f client/Dockerfile -t profilo-client:prod .

ci: check audit secrets images ## Everything the CI `check` job runs

e2e: env ## End-to-end test of the main flow (Playwright) against the running stack
	$(COMPOSE) up -d --wait
	$(MAKE) migrate
	# Each run registers a new account: start without the registration rate limits.
	$(COMPOSE) exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
	$(COMPOSE) run --rm $(AS_HOST) e2e sh -c 'npm ci --no-audit --no-fund && npm run check && npx playwright test'

api-shell: env ## Shell in the api container
	$(API_RUN) bash

hooks: ## Install git hooks (gitleaks, Ruff, Prettier before each commit)
	git config core.hooksPath .githooks
	@echo "Git hooks installed from .githooks/"
