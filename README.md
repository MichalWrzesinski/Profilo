# Profilo

A simple, professional personal page that works as an online business card — one permanent address `profilo.pl/user/{nick}` with a short bio, contact buttons and links. Polish-language interface.

## Documentation

- Product: [docs/product/overview.md](docs/product/overview.md)
- Design: [docs/design/style.md](docs/design/style.md), [design system](docs/design/design-system.html), [final mockups](docs/design/mockups/final/index.html)
- Architecture: [docs/architecture.md](docs/architecture.md), decisions in [docs/decisions/](docs/decisions/)
- API contract: [docs/api/openapi.yaml](docs/api/openapi.yaml)
- Technology and costs: [docs/technology-summary.md](docs/technology-summary.md)
- Instructions for agents: [AGENTS.md](AGENTS.md); standards in [docs/standards/](docs/standards/)

## Development

Requirements: Docker (with Compose v2) and `make`. Nothing else is installed locally — all tools run in containers.

```bash
make up      # first run: creates .env, builds images, starts everything, runs migrations
make hooks   # once per clone: gitleaks secret scan before each commit
```

| URL | What |
|---|---|
| http://localhost:8080 | App (Caddy → Next.js `client`, `/api`, `/health`, `/ready` → FastAPI `api`) |
| http://localhost:8080/api/docs | API docs (local only) |
| http://localhost:8025 | Mailpit — e-mails sent locally |

| Command | Does |
|---|---|
| `make up` / `make down` | Start / stop the stack |
| `make logs` | Follow logs |
| `make migrate` | Apply database migrations |
| `make seed` | Load demo data (none yet) |
| `make test` | Backend and frontend tests with coverage ≥ 95 % (backend uses the `profilo_test` database) |
| `make lint` | Formatters in check mode, linters, type checks |
| `make format` | Format code |
| `make contract` | Check the API against `docs/api/openapi.yaml` |
| `make check` | `lint` + `test` + `contract` |
| `make audit` / `make secrets` / `make images` | Dependency audit, gitleaks history scan, production image build |
| `make ci` | Everything the CI `check` job runs |
| `make api-shell` | Shell in the api container |

Local credentials in `.env.example` are for local development only.
