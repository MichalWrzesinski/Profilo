#!/usr/bin/env bash
# Deploys one release on this server without downtime (blue-green) and verifies it; on
# failure switches back to the previous release. Same script for staging and production.
# Layout in $APP_DIR:
#   .env                     server-only settings and secrets (bootstrap / setup script)
#   .env.secrets             runtime secrets written by the deploy workflow
#   releases/<sha>/          compose.yml (+ compose.proxied.yml), Caddyfile, deploy.sh
#                            uploaded by the workflow
#   current -> releases/<sha>  last successful release
#   caddy/Caddyfile          the live Caddy configuration (copied from the release)
#   caddy/upstreams.caddy    which colour Caddy routes to; caddy/live: the colour it loaded
#   backups/                 database dumps taken before migrations (last KEEP_DUMPS)
#   .deployed-history        every commit that passed verification here, oldest first
# Run as the deploy user:  $APP_DIR/releases/<sha>/deploy.sh <sha> [--rollback]
#   --rollback  only a commit from .deployed-history; no dump
# Migrations run only when the database is not ahead of the release: an older release
# (rollback) never meets a revision its Alembic does not know.
# DEPLOY_SKIP_PULL=1 skips pulling (local tests with preloaded images only).
set -euo pipefail

export APP_DIR="${APP_DIR:-/srv/profilo}"
KEEP_RELEASES=5
KEEP_DUMPS=5
NEW_TAG="${1:?commit sha required}"
MODE="${2:-deploy}"
[[ "$NEW_TAG" =~ ^[0-9a-f]{7,40}$ ]] || { echo "invalid commit sha: $NEW_TAG" >&2; exit 2; }
[[ "$MODE" == deploy || "$MODE" == --rollback ]] || { echo "unknown option: $MODE" >&2; exit 2; }
NEW_DIR="$APP_DIR/releases/$NEW_TAG"
[[ -f "$NEW_DIR/compose.yml" && -f "$NEW_DIR/Caddyfile" ]] || { echo "release files missing in $NEW_DIR" >&2; exit 2; }
HISTORY="$APP_DIR/.deployed-history"
LOCK="$APP_DIR/.deploy.lock"
UPSTREAMS="$APP_DIR/caddy/upstreams.caddy"
# The colour Caddy serves, written only after a successful reload (upstreams.caddy may name
# a colour Caddy never loaded if a run was killed in between).
LIVE_FILE="$APP_DIR/caddy/live"

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

# The deployment runs detached in its own session and writes to a log file on the server;
# the caller (SSH from the workflow) only follows the log. A dropped SSH connection then
# kills just the follower (SIGPIPE/SIGHUP), never the deployment itself.
if [[ "${DEPLOY_DETACHED:-0}" != 1 ]]; then
  # A second run must not truncate the log of a deployment that is still running.
  flock -n "$LOCK" true || { echo "another deployment is running"; exit 3; }
  log_file="$NEW_DIR/deploy.log"
  : > "$log_file"
  DEPLOY_DETACHED=1 setsid bash "$0" "$@" >>"$log_file" 2>&1 </dev/null &
  pid=$!
  tail -n +1 -f --pid="$pid" "$log_file" || true
  wait "$pid"
  exit $?
fi

# One deployment at a time.
exec 9>"$LOCK"
flock -n 9 || { echo "another deployment is running"; exit 3; }
trap '' HUP PIPE

set -a
# shellcheck source=/dev/null
. "$APP_DIR/.env"
set +a
if [[ "${TLS_MODE:-acme}" == acme && -z "${ACME_EMAIL:-}" ]]; then
  echo "ACME_EMAIL is required when Caddy obtains certificates itself (TLS_MODE=acme)" >&2
  exit 2
fi
PREV_TAG=""
[[ -L "$APP_DIR/current" ]] && PREV_TAG="$(basename "$(readlink "$APP_DIR/current")")"
CURL_TLS=()
[[ "${TLS_MODE:-acme}" == internal ]] && CURL_TLS=(--insecure)

# Servers deployed before the history existed: the running release counts as deployed.
[[ ! -f "$HISTORY" && -n "$PREV_TAG" ]] && echo "$PREV_TAG" > "$HISTORY"
if [[ "$MODE" == --rollback ]] && ! grep -qxF "$NEW_TAG" "$HISTORY" 2>/dev/null; then
  log "refused: $NEW_TAG was never deployed on this server (only earlier releases can be restored)"
  exit 4
fi

# compose <tag> <args…>: runs Compose with the release's own files (plus the shared-host
# override when the host's nginx terminates TLS).
compose() {
  local tag="$1"; shift
  local files=(-f "$APP_DIR/releases/$tag/compose.yml")
  if [[ "${TLS_MODE:-acme}" == proxied ]]; then
    files+=(-f "$APP_DIR/releases/$tag/compose.proxied.yml")
  fi
  IMAGE_TAG="$tag" docker compose --project-directory "$APP_DIR/releases/$tag" "${files[@]}" "$@"
}

# Container ids of services (all states), whichever release started them.
containers_of() {
  local svc
  for svc in "$@"; do
    docker ps -aq --filter label=com.docker.compose.project=profilo \
      --filter "label=com.docker.compose.service=$svc"
  done
}

running() {
  [[ -n "$(docker ps -q --filter label=com.docker.compose.project=profilo \
    --filter "label=com.docker.compose.service=$1")" ]]
}

smoke() {
  # Retries for up to 90 s: Caddy may still be obtaining a certificate or starting.
  local deadline=$((SECONDS + 90)) path code
  for path in /ready /; do
    while true; do
      if [[ "${TLS_MODE:-acme}" == proxied ]]; then
        # Straight to Caddy on its local port, as the host's nginx reaches it.
        code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
          -H "Host: $DOMAIN" -H "X-Forwarded-Proto: https" \
          "http://127.0.0.1:${PROXY_PORT:-8090}$path" 2>/dev/null)" || true
      else
        code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${CURL_TLS[@]}" \
          --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN$path" 2>/dev/null)" || true
      fi
      [[ "$code" == 200 ]] && break
      if (( SECONDS >= deadline )); then  # curl prints 000 when it gets no response
        log "smoke test failed: $path returned $code"
        return 1
      fi
      sleep 3
    done
  done
  log "smoke tests passed (/ready, /)"
}

# The colour Caddy sends traffic to: blue, green, legacy (services api/client of releases
# before blue-green) or none (first deployment).
live_colour() {
  local colour=""
  if [[ -f "$LIVE_FILE" ]]; then
    colour="$(cat "$LIVE_FILE")"
  elif [[ -f "$UPSTREAMS" ]]; then
    colour="$(grep -oE 'api-(blue|green)' "$UPSTREAMS" | head -n1 | cut -d- -f2)" || true
  fi
  case "$colour" in
    blue|green|legacy) echo "$colour" ;;
    *) if running api; then echo legacy; else echo none; fi ;;
  esac
}

app_services() {  # app_services <colour>
  case "$1" in
    blue|green) echo "api-$1 client-$1" ;;
    legacy) echo "api client" ;;
    none) ;;
    *) log "unknown colour: $1"; return 1 ;;
  esac
}

write_upstreams() {  # write_upstreams <colour>
  local api=api client=client
  case "$1" in
    blue|green) api="api-$1"; client="client-$1" ;;
    legacy) ;;
    *) log "unknown colour: $1"; return 1 ;;
  esac
  install -d -m 755 "$APP_DIR/caddy"
  cat > "$UPSTREAMS.new" <<CADDY
# Written by deploy.sh: the colour that serves traffic.
(api_upstream) {
	reverse_proxy $api:8000 {
		lb_try_duration 10s
		lb_try_interval 250ms
	}
}
(client_upstream) {
	reverse_proxy $client:3000 {
		lb_try_duration 10s
		lb_try_interval 250ms
	}
}
CADDY
  mv -f "$UPSTREAMS.new" "$UPSTREAMS"
}

# Points Caddy at <colour> with the Caddyfile of <tag>. Caddy keeps running: a reload is
# graceful (requests in flight finish on the old configuration). Caddy reads $APP_DIR/caddy,
# not the release directory, so a new release does not recreate the container.
route() {  # route <tag> <colour>
  install -d -m 755 "$APP_DIR/caddy"
  install -m 644 "$APP_DIR/releases/$1/Caddyfile" "$APP_DIR/caddy/Caddyfile.new"
  mv -f "$APP_DIR/caddy/Caddyfile.new" "$APP_DIR/caddy/Caddyfile"
  write_upstreams "$2" || return 1
  # `up` recreates Caddy only when its own settings changed (image, ports, variables, mounts).
  compose "$1" up -d --no-deps --wait --wait-timeout 60 caddy || return 1
  compose "$1" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force >/dev/null || return 1
  echo "$2" > "$LIVE_FILE"
}

remove() {  # remove <services…>: stops gracefully (30 s for running requests), then removes
  local ids
  ids="$(containers_of "$@")"
  [[ -z "$ids" ]] && return 0
  # shellcheck disable=SC2086  # one id per word
  docker stop -t 30 $ids >/dev/null && docker rm $ids >/dev/null
}

# Starts <tag> in the idle colour beside the live one; traffic switches only after the new
# API is ready. Sets TARGET; SWITCHED=1 once Caddy routes to it.
SWITCHED=0
TARGET=""
LIVE=""
switch_to() {
  local tag="$1" api_id
  LIVE="$(live_colour)"
  if [[ "$LIVE" == blue ]]; then TARGET=green; else TARGET=blue; fi
  log "live: $LIVE; starting $tag as $TARGET"
  app_services "$LIVE" >/dev/null || return 1
  # Leftovers of an interrupted run in the idle colour never serve: remove them first.
  # shellcheck disable=SC2046  # service names
  remove $(app_services "$TARGET") || return 1
  compose "$tag" up -d --no-deps --wait --wait-timeout 60 db valkey || return 1
  # shellcheck disable=SC2046
  if ! compose "$tag" up -d --no-deps --wait --wait-timeout 180 $(app_services "$TARGET"); then
    log "$TARGET did not become healthy; the live release keeps serving"
    # shellcheck disable=SC2046
    remove $(app_services "$TARGET") || true
    return 1
  fi
  api_id="$(containers_of "api-$TARGET" | head -n1)"
  if ! docker exec "$api_id" python -c \
      "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=5).status == 200 else 1)"; then
    log "api-$TARGET is not ready (database or Valkey); the live release keeps serving"
    # shellcheck disable=SC2046
    remove $(app_services "$TARGET") || true
    return 1
  fi
  SWITCHED=1
  if ! route "$tag" "$TARGET"; then
    log "Caddy did not take the new configuration"
    return 1
  fi
  log "traffic switched to $TARGET ($tag)"
}

# After a failed verification: Caddy back to the colour that served before (still running),
# the new colour removed. Instant; no image is started.
switch_back() {
  if [[ "$LIVE" == none || -z "$PREV_TAG" ]]; then
    log "no previous release to switch back to — see docs/runbook.md (Recovery)"
    return 1
  fi
  log "switching back to $LIVE ($PREV_TAG)"
  route "$PREV_TAG" "$LIVE" || return 1
  # shellcheck disable=SC2046
  remove $(app_services "$TARGET") || true
  if [[ "$BACKGROUND_SWITCHED" == 1 ]]; then
    compose "$PREV_TAG" up -d --no-deps --wait --wait-timeout 180 worker beat || return 1
  fi
  smoke && touch "$APP_DIR/releases/$PREV_TAG" && log "previous release $PREV_TAG serves again"
}

# pg_dump of the running database before migrations (deployment standard). The newest
# KEEP_DUMPS stay on the server; off-site copies are TASK-022.
dump_database() {
  running db || { log "no running database yet; nothing to dump"; return 0; }
  install -d -m 700 "$APP_DIR/backups"
  local file
  file="$APP_DIR/backups/before-$NEW_TAG-$(date -u +%Y%m%dT%H%M%SZ).dump"
  log "dumping the database to $file"
  if ! (umask 077 && compose "$NEW_TAG" exec -T db \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$file.part") \
      || ! compose "$NEW_TAG" exec -T db pg_restore --list < "$file.part" >/dev/null; then
    rm -f "$file.part"
    return 1
  fi
  mv "$file.part" "$file"
  find "$APP_DIR/backups" -maxdepth 1 -name 'before-*.dump' -printf '%T@ %p\n' | sort -rn \
    | awk -v keep="$KEEP_DUMPS" 'NR > keep {print $2}' | xargs -r rm -f
}

# Upgrades the database to the release's head unless the database is already at a revision
# this release does not know (it is ahead: a rollback, or a redeploy of an older commit).
# Decided by the database itself, so it is also right after a dump was restored. Any other
# error (database down, broken migration) fails the deployment.
KNOWN_REVISION='
import sys
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.script.revision import ResolutionError
from alembic.util import CommandError
try:
    ScriptDirectory.from_config(Config("alembic.ini")).get_revision(sys.argv[1])
except (ResolutionError, CommandError):
    sys.exit(3)
'
migrate() {
  local revision known=0
  # One Alembic head (linear history), so alembic_version has a single row.
  if running db; then
    revision="$(compose "$NEW_TAG" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAq -c \
      "select case when to_regclass('public.alembic_version') is null then '' else (select version_num from alembic_version limit 1) end")" \
      || { log "could not read the database revision"; return 1; }
  fi
  if [[ -n "${revision:-}" ]]; then
    [[ "$revision" =~ ^[A-Za-z0-9_]+$ ]] || { log "unexpected database revision: $revision"; return 1; }
    # Exit 3: the release's migrations do not contain this revision.
    compose "$NEW_TAG" --profile tools run --rm --no-deps migrate python -c "$KNOWN_REVISION" "$revision" \
      || known=$?
    if [[ "$known" == 3 ]]; then
      log "database revision $revision is newer than this release: migrations skipped"
      return 0
    elif [[ "$known" != 0 ]]; then
      log "could not check the database revision against the release"
      return 1
    fi
  fi
  # A dump before every migration that may change the schema (rollback included: the
  # database may be behind after a restore).
  dump_database || { log "database dump failed"; return 1; }
  compose "$NEW_TAG" --profile tools run --rm migrate
}

cleanup_old_releases() {
  local old
  # Newest first; keep the newest KEEP_RELEASES (always including current) with their images.
  find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn \
    | awk -v keep="$KEEP_RELEASES" 'NR > keep {print $2}' | while read -r old; do
      [[ "$old" == "$NEW_TAG" ]] && continue
      docker image rm "ghcr.io/michalwrzesinski/profilo-api:$old" \
        "ghcr.io/michalwrzesinski/profilo-client:$old" >/dev/null 2>&1 || true
      rm -rf "${APP_DIR:?}/releases/$old"
    done
}

if [[ "$MODE" == --rollback ]]; then
  log "rolling back to $NEW_TAG (running: ${PREV_TAG:-none})"
else
  log "deploying $NEW_TAG (previous: ${PREV_TAG:-none})"
fi
if [[ "${DEPLOY_SKIP_PULL:-0}" != 1 ]]; then
  if ! compose "$NEW_TAG" pull --quiet api-blue client-blue; then
    log "pulling images failed; the running release was not changed"
    exit 1
  fi
fi

# Migrations are backward compatible (backend standard), so the running release keeps working.
if ! migrate; then
  log "migration failed; the running release was not changed"
  exit 1
fi

# Background services take no requests: replaced in place once the site is verified
# (Celery finishes running tasks; exactly one beat must run).
BACKGROUND_SWITCHED=0
background() {
  BACKGROUND_SWITCHED=1
  compose "$NEW_TAG" up -d --no-deps --wait --wait-timeout 180 worker beat \
    || { log "worker or beat of $NEW_TAG did not become healthy"; return 1; }
}

if switch_to "$NEW_TAG" && smoke && background; then
  # Verified: the colour that served before stops.
  # shellcheck disable=SC2046
  remove $(app_services "$LIVE") || log "warning: could not remove the previous colour ($LIVE)"
  ln -sfn "releases/$NEW_TAG" "$APP_DIR/current"
  touch "$NEW_DIR"  # release order for cleanup = last time it became current
  grep -qxF "$NEW_TAG" "$HISTORY" 2>/dev/null || echo "$NEW_TAG" >> "$HISTORY"
  cleanup_old_releases
  # Dangling layers of Profilo's own images only (the server may host other projects).
  docker image prune -f --filter "label=org.opencontainers.image.source=https://github.com/MichalWrzesinski/Profilo" >/dev/null || true
  log "deployed $NEW_TAG ($TARGET)"
  exit 0
fi

if [[ "$SWITCHED" == 0 ]]; then
  log "new release $NEW_TAG failed before taking traffic; the running release was not changed"
  exit 1
fi
log "new release $NEW_TAG failed"
switch_back || log "switching back failed — manual action needed (docs/runbook.md, Recovery)"
exit 1
