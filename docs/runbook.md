# Runbook

Operations for staging and production. Files: `infra/server/` (`compose.yml`, `Caddyfile`, `bootstrap.sh`, `setup-shared-host.sh`, `deploy.sh`), `infra/ci/deploy-remote.sh` (the runner side shared by the workflows), workflows `deploy-staging.yml`, `deploy-production.yml`, `rollback-production.yml`.

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

Staging runs on a VPS shared with other projects (Debian 13, nginx with certbot, Docker already installed). `bootstrap.sh` must **not** run there: it changes the firewall and SSH for the whole server. Instead Profilo's Caddy listens only on `127.0.0.1:8090` without TLS (`TLS_MODE=proxied`, `compose.proxied.yml`), and the host's nginx terminates TLS for the domain and forwards to it. Caddy still sets HSTS, the fallback CSP and the other headers (pages send their own CSP with a script nonce); it trusts `X-Forwarded-For` only from the Docker gateway nginx connects through, and nginx replaces (never appends) that header with the visitor's address.

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
9. **Mail goes out** — many VPS providers block outgoing mail ports. Check from the server and from a container (changes nothing):
   ```bash
   ssh -t you@SERVER 'for p in 465 587; do timeout 6 bash -c "</dev/tcp/SMTP_HOST/$p" && echo "host $p OK" || echo "host $p BLOCKED"; done; sudo docker exec profilo-worker-1 python -c "from app.modules.notifications.mailer import _connect; from app.core.settings import get_settings as g; s=g(); c=_connect(); c.login(s.smtp_username, s.smtp_password.get_secret_value()); print(\"SMTP login OK\"); c.quit()"'
   ```
   Both ports blocked on the host while they open from another machine, with an `output` policy `accept` in `sudo nft list ruleset`: the provider blocks them — ask its support to open 465 or 587 (transactional mail through the mailbox, no bulk sending). Until then the site works but no e-mail is delivered (registration confirmation, password reset).

On the server the Compose helper of „Manual operations” works with `/srv/Profilo` in place of `/srv/profilo` and `-f …/compose.proxied.yml` added; `deploy.sh` adds it by itself when `TLS_MODE=proxied`.

## How a deployment works

Staging: after the CI workflow succeeds on `main` (its `publish` job pushed `ghcr.io/michalwrzesinski/profilo-{api,client}:<sha>`), *Deploy staging* runs. Production: the user starts *Deploy production* (below). Both run `infra/ci/deploy-remote.sh` (from `main`) with the stack files of the deployed commit:

1. checks that the commit is on `main` (staging: after CI it skips commits that are no longer the head of `main`; production: the commit must carry the status `deploy/staging = success`, which *Deploy staging* sets after a verified deployment);
2. uploads `compose.yml`, `compose.proxied.yml`, `Caddyfile`, `deploy.sh` to `$APP_DIR/releases/<sha>/` and writes runtime secrets (SMTP) to `$APP_DIR/.env.secrets` (mode 600);
3. logs the server in to GHCR with the workflow's short-lived token (logged out at the end);
4. `releases/<sha>/deploy.sh <sha>` (one at a time, lock file):
   1. pull images;
   2. migrations, each time after a `pg_dump` of the running database to `backups/before-<sha>-<time>.dump` (checked with `pg_restore --list`; the newest 5 stay) — unless the database is at a revision the release does not know (it is ahead: a rollback or an older commit; read from `alembic_version` and checked against the release's migrations). Any other error stops the deployment before anything changes;
   3. **blue-green switch**: the app services exist twice, `api-blue`/`client-blue` and `api-green`/`client-green` (each client talks to the API of its own colour). The release starts in the idle colour beside the live one, which keeps serving; it gets no traffic until its containers are healthy and the API's `/ready` passes. Then Caddy is pointed at it: `$APP_DIR/caddy/upstreams.caddy` names the colour, the release's `Caddyfile` is copied to `$APP_DIR/caddy/`, and Caddy reloads gracefully (requests in flight finish; Caddy itself keeps running);
   4. smoke tests `/ready` and `/` through Caddy (retried up to 90 s), then `worker` and `beat` are replaced in place (no traffic) → the previous colour stops (30 s for running requests), `current` symlink, the commit appended to `.deployed-history`; old releases beyond the last 5 are removed with their images;
5. if the new colour never becomes healthy or ready, it is removed and the live release keeps serving — no request reached it; if the smoke tests fail after the switch, Caddy is pointed back at the previous colour, which is still running (about a second), and the new one is removed; the workflow fails in both cases. A failed pull, dump or migration leaves the running release untouched;
6. external smoke tests: `/ready`, `/`, HTTP → HTTPS redirect, security headers (a failure here does not roll back: the release passed on the server, the problem is in front of it — DNS, the host's nginx, certificates).

Layout of `$APP_DIR` (`/srv/profilo`, `/srv/Profilo` on the shared host): `.env` (server-only), `.env.secrets` (from the workflow), `releases/<sha>/` (stack files and `deploy.log` of each release), `current` → last successful release, `caddy/Caddyfile`, `caddy/upstreams.caddy` and `caddy/live` (live Caddy configuration, routed colour, colour Caddy loaded), `backups/` (pre-migration dumps, mode 700), `.deployed-history` (commits that passed verification, oldest first).

The deployment runs detached on the server (own session, log in `releases/<sha>/deploy.log`); the workflow only follows the log, so a dropped SSH connection does not interrupt it — check the log and `current` afterwards.

If the newest commit on `main` fails CI, older green commits are skipped and staging stays on the last deployed release until `main` is green again (deploy an older commit manually if needed).

## Production

Only the user starts *Deploy production* (AGENTS.md). Both production workflows run only from `main` and only for the account `MichalWrzesinski` (also on re-runs); otherwise the job is skipped before any secret is read.

**Provision (once)** — as *Provision a staging server* with production values: CX33, the production domain (e.g. `profilo.pl`), deploy key `profilo-production-deploy`, and `bootstrap.sh production …` (writes `ROBOTS_TAG="all"`). On a shared host: `setup-shared-host.sh production …` and the *Shared host* steps. Then the GitHub settings:

| Kind | Name | Value |
|---|---|---|
| Secret | `PROD_SSH_HOST` | server IP or hostname |
| Secret | `PROD_SSH_KEY` | content of `profilo-production-deploy` (private key) |
| Secret | `PROD_SSH_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 SERVER` (verify the fingerprint) |
| Secret | `PROD_SMTP_USERNAME`, `PROD_SMTP_PASSWORD` | the production mailbox or Brevo key |
| Variable | `PROD_DOMAIN` | e.g. `profilo.pl` |
| Variable | `PROD_MAIL_FROM` | e.g. `Profilo <no-reply@profilo.pl>` — an address the SMTP account may send as (SPF, DKIM) |
| Variable (optional) | `PROD_SSH_USER`, `PROD_APP_DIR`, `PROD_SMTP_HOST`, `PROD_SMTP_PORT`, `PROD_SMTP_SECURITY` | defaults `deploy`, `/srv/profilo`, Brevo, `587`, `starttls` |
| Variable | `PROD_BACKUP_REPOSITORY` | e.g. `sftp:u123456@u123456.your-storagebox.de:/profilo` (*Backups* below) |
| Variable (optional) | `PROD_BACKUP_SFTP_PORT` | default `23` (Storage Box) |
| Secret | `PROD_BACKUP_SSH_KEY`, `PROD_BACKUP_KNOWN_HOSTS` | private key `profilo-backup` and `ssh-keyscan -p 23 u123456.your-storagebox.de` |
| Secret | `PROD_BACKUP_PASSWORD` | backup encryption key: `openssl rand -hex 32` — **also keep it outside GitHub** (password manager): without it the backups cannot be read |
| Variable | `PROD_ALERT_EMAIL` | where failed backups and the monthly restore report go |
| Secret (optional) | `PROD_BACKUP_HEARTBEAT_URL` | Better Stack heartbeat of the daily backup (*Monitoring*) |
| Secret | `PROD_SENTRY_DSN`, `PROD_SENTRY_AUTH_TOKEN` | error reporting and releases (*Monitoring*); required in production |

Check that the server can reach the SMTP port (*Shared host* step 9) before the first deployment.

**Readiness report** (the agent, when staging is green): PRs since the last `production-*` tag, the commit SHA, migrations in the release (irreversible ones marked), product decisions and views to check on staging, new secrets or settings, and the link to *Deploy production*.

**Deploy** — Actions → *Deploy production* → *Run workflow* (branch `main`) with the full SHA from the report. The workflow refuses a commit that staging has not verified. On success a separate job (the only one with write access; it never reaches the server) creates the release `production-<UTC time>` on the commit, with the PRs merged since the previous one. If that job fails, rerun it: without the tag *Rollback production* refuses the commit.

The status `deploy/staging` is only ever set (never withdrawn) and any account with write access could set it; it is a check against mistakes, not a security boundary — only the owner can start production.

**Later rollback** — Actions → *Rollback production* with the SHA of an earlier `production-*` release. The database stays as it is (it is ahead of the release, so no migration and no dump run; after a restored dump the database may be behind — then it is dumped and migrated; migrations are backward compatible, so the older release works with it), the release starts in the idle colour and takes over as in a deployment. It is refused unless the commit has a `production-*` tag and appears in the server's `.deployed-history`. The agent may start it without consent and informs the user at once: cause, version restored, state of the application. Restoring the database from a dump loses data written since and needs the user's consent (deployment standard).

## Backups (production)

The `backup` service (image `profilo-backup`, `infra/backup/`) runs on the production server whenever the deploy workflow delivered its settings (`$APP_DIR/backup/config` and `backup/keys/`; production requires them, staging has none — test data only):

- **daily at 02:30 UTC**: `pg_dump` of the database and the `media` volume as restic snapshots (AES-256, deduplicated) over SFTP to the repository in `PROD_BACKUP_REPOSITORY`, in another location than the server; then snapshots more than 30 days older than the newest one are removed and their data deleted from the repository (`--max-unused 0`; privacy policy: deleted data leaves the backups after at most 30 days — as long as the daily backup runs; while it fails nothing is removed and an alert goes out every day). A dump that fails leaves no snapshot;
- **monthly on the 1st at 04:30 UTC**: restore test — fails if the newest `db` or `media` snapshot is older than 36 h (daily backups broken), then the latest database snapshot into a temporary database `restore_test_<time>` on the production PostgreSQL, row counts per table (restored / live), media file count, `restic check` reading back 5 % of the data; the temporary database is dropped, also when the test fails. It fails if the restored database or the media snapshot is empty while the server has data. The report goes to `PROD_ALERT_EMAIL`;
- **any failure** (repository unreachable, dump failed, check failed) sends an alert to `PROD_ALERT_EMAIL` with the job's log, through the application's SMTP account. A deployment stops a running job cleanly (repository unlocked) and it runs again after the container restarts. Results: `/state/last-backup-ok|failed`, `last-restore-test-ok|failed` in the `backup_state` volume (for monitoring, TASK-023).

**Storage Box (once)** — Hetzner Storage Box (e.g. BX11) in another location than the server (e.g. Helsinki when the server is in Falkenstein), SSH support switched on. Then, on your computer:

```bash
ssh-keygen -t ed25519 -N "" -C "profilo-backup" -f profilo-backup
```
```bash
cat profilo-backup.pub | ssh -p 23 u123456@u123456.your-storagebox.de install-ssh-key
```
```bash
ssh-keyscan -p 23 u123456.your-storagebox.de | gh secret set PROD_BACKUP_KNOWN_HOSTS
```
```bash
gh secret set PROD_BACKUP_SSH_KEY < profilo-backup
```
```bash
openssl rand -hex 32 | tee /dev/tty | gh secret set PROD_BACKUP_PASSWORD
```
Save the printed key in your password manager, then set the variables `PROD_BACKUP_REPOSITORY` and `PROD_ALERT_EMAIL` and delete `profilo-backup` from your computer. The repository is created at the first backup (right after the first deployment, as 02:30 has passed). Any SFTP server works the same way; another provider than Hetzner must be named in the privacy policy.

| Task | Command (on the server, `dc` helper below) |
|---|---|
| Backup now | `dc exec backup profilo-backup backup` |
| Restore test now | `dc exec backup profilo-backup restore-test` |
| List snapshots | `dc exec backup profilo-backup snapshots` |
| Logs | `dc logs --tail=100 backup` |
| Restore the database from the latest off-site backup — **only with the user's consent** (data written since the backup is lost) | `dc stop api-$(live) client-$(live) worker beat`, then `dc exec -T backup profilo-backup dump-db > /tmp/restore.dump` and `dc exec -T db pg_restore -U profilo -d profilo --clean --if-exists < /tmp/restore.dump`, then `dc start api-$(live) client-$(live) worker beat`, delete `/tmp/restore.dump`. An older snapshot: `profilo-backup restic snapshots --tag db`, then `profilo-backup restic dump <id> /profilo.dump` |
| Restore media — same consent | `dc run --rm --no-deps -v profilo_media:/restore/data/media backup restic restore --host profilo --tag media latest --target /restore` (the service itself mounts the volume read-only) |

## Monitoring

- **Errors → Sentry** (EU region): api and worker (`app/core/monitoring.py`), the Next.js server (`src/instrumentation.ts`) and the browser (`src/instrumentation-client.ts`). Release = commit SHA, environment = `staging` / `production`, tag `service` = `api`, `worker`, `client-server` or `browser`, tag `request_id` (matches `X-Request-ID` and the logs). The browser never talks to Sentry (CSP allows only our origin): it posts to `/api/v1/monitoring/sentry`, where the API keeps error events only, scrubs them again and forwards them with the server's DSN (30 reports per 10 min per IP). Error-level log entries (e.g. `email_failed`, `rate_limit_unavailable`) are reported too.
- **No personal data**: no request bodies, cookies, headers (except the browser name), user data or frame variables are collected; every event is scrubbed (e-mail addresses, JWTs and long tokens, phone numbers, `token=`/`email=` in URLs, keys like `password`/`token`/`email`, SQL parameters, password hashes, and the exact passwords of the current request). Without `SENTRY_DSN` reporting is off and the tunnel drops reports.
- **Source maps**: built into the client image (with debug IDs) outside the served directory (`/opt/sourcemaps`); the deploy workflows' *Sentry release* job uploads them, creates the release and records the deployment.
- **Uptime → Better Stack**: monitors on `/ready` of staging and production; the daily backup sends a heartbeat.
- **Failed deployments**: GitHub's failure e-mails of the deploy workflows.

**Sentry (once)** — account in the **EU** region (`de.sentry.io`), one project `profilo` for all services (environments keep staging and production apart). In the project: *Security & Privacy* → *Data Scrubber* and *Use Default Scrubbers* on, *Prevent Storing of IP Addresses* on (a second line of defence). *Alerts*: an issue alert "A new issue is created" → e-mail, and an issue alert "Number of events in an issue is more than 20 in 5 minutes" → e-mail (error spike). Optional: the GitHub integration, so releases link to commits. Then:

| Kind | Name | Value |
|---|---|---|
| Secret | `STAGING_SENTRY_DSN`, `PROD_SENTRY_DSN` | the project's DSN (*Client Keys*); may be the same |
| Secret | `STAGING_SENTRY_AUTH_TOKEN`, `PROD_SENTRY_AUTH_TOKEN` | an organisation auth token (scopes `project:releases`, `org:read`) |
| Variable | `SENTRY_ORG`, `SENTRY_PROJECT` | the slugs, e.g. `profilo` |
| Variable (optional) | `SENTRY_URL` | only for a user token or self-hosted Sentry; an organisation token (`sntrys_…`) carries its own address and region |

Staging works without them (no reports). Production refuses to deploy without `PROD_SENTRY_DSN` (checked before anything changes); a missing `PROD_SENTRY_AUTH_TOKEN` fails only the *Sentry release* job, after the deployment — production then serves the release without source maps in Sentry; set the token and rerun that job. Images built before TASK-023 have no source maps: the job records the release and deployment only.

**Volume** — each kind of error-level log entry is reported at most once per 10 minutes per process (with the number left out since, `not_reported_since_last`), and the tunnel forwards at most 60 browser events per 10 minutes per process: an outage that logs on every request cannot use up the quota. Also switch on *Spike Protection* in the Sentry organisation settings. A failed e-mail appears twice (the Celery task's exception and `email_failed` with the template).

**Better Stack (once)** — *Uptime* → *Monitors* → *Create monitor* for `https://<staging domain>/ready` and `https://<production domain>/ready`: alert when "URL becomes unavailable" (any status other than 200), e-mail to you, check frequency 30 s or 1 min and confirmation period 2 min — scenario: `/ready` failing for 2 minutes sends an e-mail (the plan must allow that frequency; with 3-minute checks the alert comes later). *Heartbeats* → *Create heartbeat* "Profilo backups", expected every 1 day, grace period 2 hours; its URL goes into `PROD_BACKUP_HEARTBEAT_URL` (the backup pings it after each daily run and `…/fail` after a failure).

**GitHub (once)** — *Settings* → *Notifications* → *System* → *Actions*: e-mail, "Only notify for failed workflows": a failed *Deploy staging*, *Deploy production* or *Rollback production* reaches you.

| Task | Command / place |
|---|---|
| Test event from the API (after a deployment) | `dc exec api-$(live) python -c "import app.main, sentry_sdk; sentry_sdk.capture_message('profilo test'); sentry_sdk.flush()"` — appears in Sentry with the release and environment |
| Test event from the worker | `dc exec worker python -c "from app.core.monitoring import init_sentry; import sentry_sdk; init_sentry('worker'); sentry_sdk.capture_message('profilo worker test'); sentry_sdk.flush()"` |
| An error's details in the logs | the `request_id` tag of the Sentry event = `request_id` in `dc logs api-$(live)` and in Caddy's access log |

## Manual operations (as `deploy` on the server, in `/srv/profilo`)

Helpers for the commands below — `live` prints the serving colour (`blue` or `green`):
`live() { cat /srv/profilo/caddy/live; }`
`dc() { set -a; . /srv/profilo/.env; set +a; t=$(basename "$(readlink /srv/profilo/current)"); APP_DIR=/srv/profilo IMAGE_TAG=$t docker compose --project-directory /srv/profilo/current -f /srv/profilo/current/compose.yml "$@"; }`

| Task | Command |
|---|---|
| Current release | `readlink /srv/profilo/current` |
| Status | `dc ps` |
| Logs | `dc logs -f --tail=100 api-$(live)`; the Caddy access log (with IPs, kept 14 days) is a file: `dc exec caddy tail -f /data/logs/access.log` |
| Redeploy or roll back to a commit | Staging: *Deploy staging* → *Run workflow* with the SHA (any commit on `main` whose images exist; migrations are skipped when the database is ahead of it). Production: *Rollback production* (above) |
| Pre-migration dumps | `ls -lt $APP_DIR/backups`; restore only with the user's consent: `dc stop api-$(live) client-$(live) worker beat`, `dc exec -T db pg_restore -U profilo -d profilo --clean --if-exists < backups/<file>.dump`, `dc start api-$(live) client-$(live) worker beat` |
| Restart | `dc restart` |
| Block a page reported as illegal (PUB-BR-10) | `dc exec api-$(live) profilo block-profile <nick>` — the page, its images and its preview card return 404 at once (browsers and messenger previews may keep images and the card for up to a day), the owner sees „Strona zablokowana”; send the owner the statement of reasons by e-mail (terms §5). If the owner deletes the account, the nick stays reserved (`reserved_nicks`, reason `blocked`); to free it: `dc exec db psql -U profilo -c "delete from reserved_nicks where nick='<nick>' and reason='blocked'"`. Exit codes: 0 done, 1 unknown nick, 3 database or Valkey unavailable |
| Unblock a page | `dc exec api-$(live) profilo unblock-profile <nick>` — the last published version is visible again |
| Abuse report address | `ABUSE_EMAIL` in `/srv/profilo/.env` (the „Zgłoś nadużycie” link on every page, the editor preview and the terms; an odd value is ignored and the non-deliverable placeholder is shown); apply by rerunning the deploy workflow with the current SHA (a new colour reads `.env`; a restart does not) |
| Before restoring the database or the media volume | `dc stop beat` (no cleanup job runs against a half-restored database; the orphan cleanup also stops by itself when most files look orphaned, log `orphan_cleanup_aborted`); `dc start beat` once the restore is checked |
| Log shows `orphan_cleanup_aborted` | First check the database is complete (`dc exec db psql -U profilo -c 'select count(*) from images'` against the folders in the media volume). If it is and the orphans are real (e.g. after an outage of the queue), raise the limit once: `dc exec worker python -c "import asyncio; from app.modules.media import service as m; m.MAX_ORPHAN_SHARE = 1.0; print(asyncio.run(m.remove_orphaned_files()))"` |
| Run a cleanup job now | `dc exec worker celery -A app.worker call accounts.delete_unconfirmed` (or `profiles.release_quarantined_nicks`, `media.remove_orphaned_files`); result in `dc logs worker` as `job_done` with counts |

## Recovery

| Situation | What to do |
|---|---|
| Workflow failed, log says "previous release … serves again" or "failed before taking traffic" | The previous release serves (production: tell the user). Fix the cause in a new PR; nothing to do on the server. |
| Pull or migration failed | The running release was not changed. Fix in a PR. A migration that failed half-way is rolled back by PostgreSQL's transactional DDL; check `dc --profile tools run --rm migrate alembic current`. |
| First deployment failed (no previous release) | The stack may be up with an unhealthy service and `/ready` 502. Read `dc logs api-blue`, fix in a PR, merge → the next deployment replaces it. |
| "switching back failed — manual action needed" | Staging: run *Deploy staging* with the last good SHA (`tail $APP_DIR/.deployed-history`). Production: *Rollback production* with the last good `production-*` release, and inform the user. If that fails too, inform the user with the logs; do not change the server by hand. |
| Rollback refused: "never deployed" | Only commits in the server's `.deployed-history` (and, in production, with a `production-*` tag) can be restored. Choose one of those. |
| Containers of both colours after an interrupted run (`docker ps`) | Only the colour in `caddy/live` gets traffic; the next deployment removes the idle colour's containers before it starts. A run interrupted after the switch but before verification may leave the new colour serving without `current` updated — rerun the workflow with the SHA you want. |
| "a deployment is still running" | A deployment continues on the server after a dropped connection. Wait for it (`tail -f releases/<sha>/deploy.log`), then check `current`; in production, if it finished, the `production-*` tag is missing — rerun *Deploy production* with that SHA. |
| "another deployment is running" | Wait for the other run to finish and rerun the workflow (the lock is released automatically when `deploy.sh` exits). |
| Server lost | Create a new server and repeat *Provision*; staging data is not backed up (test data only). |

Never change code, configuration or data on the server by hand (deployment standard). Fixes go through a PR.

## Notes

- Caddy obtains Let's Encrypt certificates automatically; `TLS_MODE=internal` in `.env` is only for local test VMs.
- Staging sends `X-Robots-Tag: noindex, nofollow`.
- Container logs rotate at 10 MB × 14 files per service; Caddy logs contain visitor IPs, the API logs do not.
- Docker-published ports bypass ufw; the stack publishes only 80 and 443.
- User images live in the `media` volume (`/data/media` in api and worker). Caddy limits request bodies to 1 MB, 11 MB for image uploads. The volume is not backed up on staging; production backups (database and media, off-site) come with TASK-022.
- Releases switch without downtime (see *How a deployment works*). Caddy is recreated only when its own settings in `compose.yml` change (image, ports, variables, mounts), with a gap of about 2 s; the move from the old layout (Caddy reading the release directory, services `api`/`client`) does that once on staging.
- A page loaded just before the switch may fetch a script of the previous version afterwards (Next.js chunks): rare, fixed by a reload. Migrations and API changes are backward compatible (backend standard).
- Secrets added later (Brevo, Sentry, Storage Box) are delivered by the deploy workflows (AGENTS.md).
