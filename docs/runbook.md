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

## Shared host (the server's own nginx serves 80/443)

Staging runs on a VPS shared with other projects (Debian 13, nginx with certbot, Docker already installed). `bootstrap.sh` must **not** run there: it changes the firewall and SSH for the whole server. Instead Profilo's Caddy listens only on `127.0.0.1:8090` without TLS (`TLS_MODE=proxied`, `compose.proxied.yml`), and the host's nginx terminates TLS for the domain and forwards to it. Caddy still sets HSTS, CSP and the other headers; it trusts `X-Forwarded-For` only from the Docker gateway nginx connects through, and nginx replaces (never appends) that header with the visitor's address.

Once, on your computer and on the server (example values: `profilo.gitpush.app`, `/srv/Profilo`, user `profilo_deploy`, port 8090; `SERVER` = the server's address, `you` = your sudo account):

1. **Deploy key** (on your computer):
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions-staging" -f profilo-staging-deploy
   ```
2. **Look before changing anything** (as you, on the server) — the current site file, where the temporary page lives and how certbot renews the certificate:
   ```bash
   readlink -f /etc/nginx/sites-enabled/Profilo; grep -E 'root|ssl_certificate' /etc/nginx/sites-enabled/Profilo
   sudo grep -E 'authenticator|webroot' /etc/letsencrypt/renewal/profilo.gitpush.app.conf
   ls /etc/letsencrypt/options-ssl-nginx.conf /etc/letsencrypt/ssl-dhparams.pem; ls -A /srv/Profilo
   ip -4 route; docker network ls -q | xargs docker network inspect -f '{{.Name}} {{range .IPAM.Config}}{{.Subnet}} {{end}}'
   ```
   - No route or Docker network may cover `172.28.0.0/24` (also not a wide one such as `172.16.0.0/12`); otherwise pick another `/24` for step 3.
   - If `/srv/Profilo` holds the temporary page, move it away first (e.g. `sudo mv /srv/Profilo /srv/Profilo-temp`); the setup refuses a directory with other files. The domain shows an nginx error until the first deployment (step 8).
   - If certbot uses `webroot`, put its path into the `location /.well-known/acme-challenge/` block of `nginx-profilo.conf` instead of `/var/www/html` (with `authenticator = nginx` nothing needs changing).
   - If one of the two `/etc/letsencrypt/…` files is missing, remove its line from `nginx-profilo.conf`.
3. **Prepare the server** — creates the deploy user (key only, `restrict`ed: no tunnels), `/srv/Profilo` and its `.env`; changes nothing else:
   ```bash
   scp infra/server/setup-shared-host.sh infra/server/nginx-profilo.conf you@SERVER:/tmp/
   ssh -t you@SERVER "sudo bash /tmp/setup-shared-host.sh staging profilo.gitpush.app \"$(cat profilo-staging-deploy.pub)\" /srv/Profilo profilo_deploy 8090"
   ```
   It stops with a message if the user already exists (and was not created by it), if port 8090 or the Docker subnet `172.28.0.0/16` is taken, or if another Compose project is called `profilo` (pass other values as the 6th and 7th argument).
   **The `profilo_deploy` user can run Docker, which is root-equivalent on the whole server, including the other projects.** Its key lives only in the GitHub secret; anyone who can change the deploy workflow on GitHub can act as it.
4. **Check the key login** (an `AllowUsers` line in `/etc/ssh/sshd_config` may need the new user):
   ```bash
   ssh -i profilo-staging-deploy profilo_deploy@SERVER 'docker ps --format "{{.Names}}" | head -3'
   ```
5. **GitHub secrets and variables** (from the repository folder on your computer, `gh` logged in):
   ```bash
   gh secret set STAGING_SSH_HOST --body "SERVER"
   gh secret set STAGING_SSH_KEY < profilo-staging-deploy
   ssh-keyscan -t ed25519 SERVER | gh secret set STAGING_SSH_KNOWN_HOSTS
   gh variable set STAGING_DOMAIN --body "profilo.gitpush.app"
   gh variable set STAGING_SSH_USER --body "profilo_deploy"
   gh variable set STAGING_APP_DIR --body "/srv/Profilo"
   gh variable set STAGING_SMTP_HOST --body "smtp.example.pl"     # your mailbox's SMTP server
   gh variable set STAGING_SMTP_PORT --body "587"                 # or 465
   gh variable set STAGING_SMTP_SECURITY --body "starttls"        # or ssl for port 465
   gh variable set STAGING_MAIL_FROM --body "Profilo <adres@twojadomena.pl>"
   gh secret set STAGING_SMTP_USERNAME                            # asks for the value
   gh secret set STAGING_SMTP_PASSWORD                            # asks for the value
   ```
   Compare the `ssh-keyscan` fingerprint with the one the server shows (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`), then delete `profilo-staging-deploy` from your computer. The sender in `STAGING_MAIL_FROM` must be an address that mailbox may send as, or mail lands in spam.
6. **nginx** — save the old site file and switch; if the test fails, the old file comes back on its own, so a broken config never stays (a failed reload, e.g. at the next certificate renewal, would stop every site on the server); the first backup is kept on repeated runs (`cp -n`):
   ```bash
   ssh -t you@SERVER 'site=$(readlink -f /etc/nginx/sites-enabled/Profilo) && sudo cp -n "$site" /root/Profilo.nginx.before-profilo && sudo cp /tmp/nginx-profilo.conf "$site" && { sudo nginx -t && sudo systemctl reload nginx; } || { sudo cp /root/Profilo.nginx.before-profilo "$site" && sudo nginx -t && echo "nginx config restored"; }'
   ```
   Until the first deployment the domain answers 502. To go back later: copy `/root/Profilo.nginx.before-profilo` over the site file, `sudo nginx -t`, reload.
7. **Certificate renewal still works** with the new site file:
   ```bash
   ssh -t you@SERVER 'sudo certbot renew --dry-run --cert-name profilo.gitpush.app'
   ```
8. **First deployment** — Actions → *Deploy staging* → *Run workflow* with the latest `main` SHA (afterwards every merge deploys).

On the server the Compose helper of „Manual operations” works with `/srv/Profilo` in place of `/srv/profilo` and `-f …/compose.proxied.yml` added; `deploy.sh` adds it by itself when `TLS_MODE=proxied`.

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
| Logs | `dc logs -f --tail=100 api`; the Caddy access log (with IPs, kept 14 days) is a file: `dc exec caddy tail -f /data/logs/access.log` |
| Redeploy or roll back to a commit | GitHub Actions → *Deploy staging* → *Run workflow* with the SHA (any commit on `main` whose images exist) |
| Restart | `dc restart` |
| Block a page reported as illegal (PUB-BR-10) | `dc exec api profilo block-profile <nick>` — the page, its images and its preview card return 404 at once (browsers and messenger previews may keep images and the card for up to a day), the owner sees „Strona zablokowana”; send the owner the statement of reasons by e-mail (terms §5). If the owner deletes the account, the nick stays reserved (`reserved_nicks`, reason `blocked`); to free it: `dc exec db psql -U profilo -c "delete from reserved_nicks where nick='<nick>' and reason='blocked'"`. Exit codes: 0 done, 1 unknown nick, 3 database or Valkey unavailable |
| Unblock a page | `dc exec api profilo unblock-profile <nick>` — the last published version is visible again |
| Abuse report address | `ABUSE_EMAIL` in `/srv/profilo/.env` (the „Zgłoś nadużycie” link on every page, the editor preview and the terms; an odd value is ignored and the non-deliverable placeholder is shown); apply with `dc up -d client` (a restart does not re-read `.env`) |
| Before restoring the database or the media volume | `dc stop beat` (no cleanup job runs against a half-restored database; the orphan cleanup also stops by itself when most files look orphaned, log `orphan_cleanup_aborted`); `dc start beat` once the restore is checked |
| Log shows `orphan_cleanup_aborted` | First check the database is complete (`dc exec db psql -U profilo -c 'select count(*) from images'` against the folders in the media volume). If it is and the orphans are real (e.g. after an outage of the queue), raise the limit once: `dc exec worker python -c "import asyncio; from app.modules.media import service as m; m.MAX_ORPHAN_SHARE = 1.0; print(asyncio.run(m.remove_orphaned_files()))"` |
| Run a cleanup job now | `dc exec worker celery -A app.worker call accounts.delete_unconfirmed` (or `profiles.release_quarantined_nicks`, `media.remove_orphaned_files`); result in `dc logs worker` as `job_done` with counts |

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
