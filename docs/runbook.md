# Runbook

Operations for staging (and production from TASK-021). Files: `infra/server/` (`compose.yml`, `Caddyfile`, `bootstrap.sh`, `deploy.sh`), workflow `.github/workflows/deploy-staging.yml`.

## Provision a staging server (once)

1. **Create the server** — Hetzner Cloud, Ubuntu 24.04, CX23, location Falkenstein or Helsinki. Add your own SSH key for root during creation.
2. **DNS** — `A` (and `AAAA`) record for the staging domain (e.g. `staging.profilo.pl`) pointing to the server.
3. **Deploy key** — on your computer:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions-staging" -f profilo-staging-deploy
   ```
4. **Bootstrap** — copy the script and run it as root (it disables root SSH login at the end, so use the deploy user afterwards):
   ```bash
   scp infra/server/bootstrap.sh root@SERVER:/root/
   ssh root@SERVER "bash /root/bootstrap.sh staging staging.profilo.pl \"$(cat profilo-staging-deploy.pub)\" you@example.com"
   ```
   The last argument is the e-mail for Let's Encrypt expiry notices. The script validates the key, installs Docker and automatic security updates (with automatic reboot at 04:00 when needed), opens only ports 22/80/443, creates the `deploy` user (SSH key only), disables root and password login, and writes `/srv/profilo/.env` with a generated database password (never leaves the server). Keep the Hetzner console at hand the first time: if SSH is misconfigured it stops before locking anything down.
5. **GitHub settings** (repository → Settings → Secrets and variables → Actions):

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `STAGING_SSH_HOST` | server IP or hostname |
   | Secret | `STAGING_SSH_KEY` | content of `profilo-staging-deploy` (private key) |
   | Secret | `STAGING_SSH_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 SERVER` (verify the fingerprint in the Hetzner console) |
   | Variable | `STAGING_DOMAIN` | `staging.profilo.pl` |
   | Secret | `STAGING_SMTP_USERNAME` | Brevo SMTP login (Brevo → SMTP & API → SMTP) |
   | Secret | `STAGING_SMTP_PASSWORD` | Brevo SMTP key for staging |
   | Variable | `STAGING_MAIL_FROM` | e.g. `Profilo <no-reply@staging.profilo.pl>` — a sender/domain verified in Brevo (SPF, DKIM) |

   Then delete the private key file from your computer.
6. **First deployment** — Actions → *Deploy staging* → *Run workflow* with the latest `main` commit SHA, or merge any PR.

## How a deployment works

After the CI workflow succeeds on `main` (its `publish` job pushed `ghcr.io/michalwrzesinski/profilo-{api,client}:<sha>`), *Deploy staging* runs:

1. checks that the commit is on `main`; after CI it skips commits that are no longer the head of `main` (the newer commit deploys);
2. uploads `compose.yml`, `Caddyfile`, `deploy.sh` to `/srv/profilo/releases/<sha>/` and writes runtime secrets (SMTP) to `/srv/profilo/.env.secrets` (mode 600);
3. logs the server in to GHCR with the workflow's short-lived token (logged out at the end);
4. `releases/<sha>/deploy.sh <sha>` (one at a time, lock file): pull images → migrations (`migrate` service) → `docker compose up --wait` (health checks) → Caddy reload → smoke tests `/ready` and `/` through Caddy (retried up to 90 s) → `current` symlink to the release; old releases beyond the last 5 are removed with their images;
5. if start or smoke tests fail, the previous release (its images and its stack files) is restored and the workflow fails; a failed pull or migration leaves the running release untouched;
6. external smoke tests: `/ready`, `/`, HTTP → HTTPS redirect, security headers.

Layout of `/srv/profilo`: `.env` (server-only), `releases/<sha>/` (stack files and `deploy.log` of each release), `current` → last successful release.

The deployment runs detached on the server (own session, log in `releases/<sha>/deploy.log`); the workflow only follows the log, so a dropped SSH connection does not interrupt it — check the log and `current` afterwards.

If the newest commit on `main` fails CI, older green commits are skipped and staging stays on the last deployed release until `main` is green again (deploy an older commit manually if needed).

## Manual operations (as `deploy` on the server, in `/srv/profilo`)

Helper for the commands below: `dc() { set -a; . /srv/profilo/.env; set +a; t=$(basename "$(readlink /srv/profilo/current)"); APP_DIR=/srv/profilo IMAGE_TAG=$t docker compose --project-directory /srv/profilo/current -f /srv/profilo/current/compose.yml "$@"; }`

| Task | Command |
|---|---|
| Current release | `readlink /srv/profilo/current` |
| Status | `dc ps` |
| Logs | `dc logs -f --tail=100 api` |
| Redeploy or roll back to a commit | GitHub Actions → *Deploy staging* → *Run workflow* with the SHA (any commit on `main` whose images exist) |
| Restart | `dc restart` |

## Recovery

| Situation | What to do |
|---|---|
| Workflow failed, log says "previous release … restored" | Staging runs the previous release. Fix the cause in a new PR; nothing to do on the server. |
| Pull or migration failed | The running release was not changed. Fix in a PR. A migration that failed half-way is rolled back by PostgreSQL's transactional DDL; check `dc --profile tools run --rm migrate alembic current`. |
| First deployment failed (no previous release) | The stack may be up with an unhealthy service and `/ready` 502. Read `dc logs api`, fix in a PR, merge → the next deployment replaces it. |
| "rollback failed — manual action needed" | Run *Deploy staging* manually with the last good SHA from `ls -t /srv/profilo/releases`. If that fails too, inform the user with the logs; do not change the server by hand. |
| "another deployment is running" | Wait for the other run to finish and rerun the workflow (the lock is released automatically when `deploy.sh` exits). |
| Server lost | Create a new server and repeat *Provision*; staging data is not backed up (test data only). |

Never change code, configuration or data on the server by hand (deployment standard). Fixes go through a PR.

## Notes

- Caddy obtains Let's Encrypt certificates automatically; `TLS_MODE=internal` in `.env` is only for local test VMs.
- Staging sends `X-Robots-Tag: noindex, nofollow`.
- Container logs rotate at 10 MB × 14 files per service; Caddy logs contain visitor IPs, the API logs do not.
- Docker-published ports bypass ufw; the stack publishes only 80 and 443.
- User images live in the `media` volume (`/data/media` in api and worker). Caddy limits request bodies to 1 MB, 11 MB for image uploads. The volume is not backed up on staging; production backups come with TASK-021.
- Caddy is recreated on every new release (its configuration directory is the release directory), causing a short gap; acceptable on staging, production needs zero downtime (TASK-021).
- Secrets added later (Brevo, Sentry, Storage Box) are delivered by the deploy workflows (AGENTS.md).
