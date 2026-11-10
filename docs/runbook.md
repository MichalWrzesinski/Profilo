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
   ssh root@SERVER "bash /root/bootstrap.sh staging staging.profilo.pl \"$(cat profilo-staging-deploy.pub)\""
   ```
   It installs Docker and automatic security updates, opens only ports 22/80/443, creates the `deploy` user (SSH key only), and writes `/srv/profilo/.env` with a generated database password (never leaves the server).
5. **GitHub settings** (repository → Settings → Secrets and variables → Actions):

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `STAGING_SSH_HOST` | server IP or hostname |
   | Secret | `STAGING_SSH_KEY` | content of `profilo-staging-deploy` (private key) |
   | Secret | `STAGING_SSH_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 SERVER` (verify the fingerprint in the Hetzner console) |
   | Variable | `STAGING_DOMAIN` | `staging.profilo.pl` |

   Then delete the private key file from your computer.
6. **First deployment** — Actions → *Deploy staging* → *Run workflow* with the latest `main` commit SHA, or merge any PR.

## How a deployment works

After the CI workflow succeeds on `main` (its `publish` job pushed `ghcr.io/michalwrzesinski/profilo-{api,client}:<sha>`), *Deploy staging* runs:

1. uploads `compose.yml`, `Caddyfile`, `deploy.sh` to `/srv/profilo/`;
2. logs the server in to GHCR with the workflow's short-lived token (logged out at the end);
3. `deploy.sh <sha>`: pull images → migrations (`migrate` service) → `docker compose up --wait` (health checks) → smoke tests `/ready` and `/` through Caddy → records the version in `.deployed-tag`;
4. if start or smoke tests fail, `deploy.sh` restores the previous version and the workflow fails; a failed migration leaves the running version untouched;
5. external smoke tests: `/ready`, `/`, HTTP → HTTPS redirect, security headers.

## Manual operations (as `deploy` on the server, in `/srv/profilo`)

| Task | Command |
|---|---|
| Current version | `cat .deployed-tag` |
| Status | `IMAGE_TAG=$(cat .deployed-tag) docker compose ps` |
| Logs | `IMAGE_TAG=$(cat .deployed-tag) docker compose logs -f --tail=100 api` |
| Redeploy a commit | GitHub Actions → *Deploy staging* → *Run workflow* (preferred), or `./deploy.sh <sha>` after `docker login ghcr.io` |
| Restart | `IMAGE_TAG=$(cat .deployed-tag) docker compose restart` |

Never change code, configuration or data on the server by hand (deployment standard). Fixes go through a PR.

## Notes

- Caddy obtains Let's Encrypt certificates automatically; `TLS_MODE=internal` in `.env` is only for local test VMs.
- Staging sends `X-Robots-Tag: noindex, nofollow`.
- Container logs rotate at 10 MB × 14 files per service; Caddy logs contain visitor IPs, the API logs do not.
- Docker-published ports bypass ufw; the stack publishes only 80 and 443.
- Secrets added later (Brevo, Sentry, Storage Box) are delivered by the deploy workflows (AGENTS.md).
