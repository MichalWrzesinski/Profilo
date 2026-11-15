#!/usr/bin/env bash
# Deploys one release on this server without downtime and verifies it; on failure restores
# the previous release. Same script for staging and production. Layout in $APP_DIR:
#   .env                     server-only settings and secrets (bootstrap / setup script)
#   .env.secrets             runtime secrets written by the deploy workflow
#   releases/<sha>/          compose.yml (+ compose.proxied.yml), Caddyfile, deploy.sh
#                            uploaded by the workflow
#   current -> releases/<sha>  last successful release
#   caddy/Caddyfile          the live Caddy configuration (copied from the release)
#   backups/                 database dumps taken before migrations (last KEEP_DUMPS)
#   .deployed-history        every commit that passed verification here, oldest first
# Run as the deploy user:  $APP_DIR/releases/<sha>/deploy.sh <sha> [--rollback]
#   --rollback  only a commit from .deployed-history; no dump, no migrations
# A commit deployed here before never runs its migrations again: the database may be ahead
# of it, and an older Alembic would not know the newer revision.
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

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

# The deployment runs detached in its own session and writes to a log file on the server;
# the caller (SSH from the workflow) only follows the log. A dropped SSH connection then
# kills just the follower (SIGPIPE/SIGHUP), never the deployment itself.
if [[ "${DEPLOY_DETACHED:-0}" != 1 ]]; then
  log_file="$NEW_DIR/deploy.log"
  : > "$log_file"
  DEPLOY_DETACHED=1 setsid bash "$0" "$@" >>"$log_file" 2>&1 </dev/null &
  pid=$!
  tail -n +1 -f --pid="$pid" "$log_file" || true
  wait "$pid"
  exit $?
fi

# One deployment at a time.
exec 9>"$APP_DIR/.deploy.lock"
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
DEPLOYED_BEFORE=0
[[ -f "$HISTORY" ]] && grep -qxF "$NEW_TAG" "$HISTORY" && DEPLOYED_BEFORE=1
if [[ "$MODE" == --rollback && "$DEPLOYED_BEFORE" != 1 ]]; then
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

# Container ids of one service (all states), whichever release started them.
containers_of() {
  docker ps -aq --filter label=com.docker.compose.project=profilo \
    --filter "label=com.docker.compose.service=$1"
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

# Caddy reads its configuration from $APP_DIR/caddy (not from the release directory), so the
# container stays the same across releases and keeps serving while a release is switched.
install_caddyfile() {
  install -d -m 755 "$APP_DIR/caddy"
  install -m 644 "$APP_DIR/releases/$1/Caddyfile" "$APP_DIR/caddy/Caddyfile.new"
  mv -f "$APP_DIR/caddy/Caddyfile.new" "$APP_DIR/caddy/Caddyfile"
}

reload_caddy() {
  install_caddyfile "$1"
  # `up` recreates Caddy only when its own settings changed (image, ports, variables).
  compose "$1" up -d --no-deps --wait --wait-timeout 60 caddy || return 1
  compose "$1" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force >/dev/null
}

wait_healthy() {
  local id="$1" deadline=$((SECONDS + 180)) status
  while true; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo gone)"
    case "$status" in
      healthy) return 0 ;;
      unhealthy|exited|dead|gone) log "container ${id:0:12} is $status"; return 1 ;;
    esac
    (( SECONDS >= deadline )) && { log "container ${id:0:12} not healthy after 180 s"; return 1; }
    sleep 2
  done
}

# Blue-green for one service behind Caddy: a container of the new release starts next to the
# running one and joins the service's DNS name; the old one is stopped (gracefully, in-flight
# requests finish) only after the new one is healthy. Caddy retries a request whose
# connection fails, so the switch does not drop requests.
swap() {
  local tag="$1" svc="$2" old new id count
  old="$(containers_of "$svc")"
  count="$(wc -w <<<"$old")"
  compose "$tag" up -d --no-deps --no-recreate --scale "$svc=$((count + 1))" "$svc" || return 1
  new="$(comm -13 <(sort <<<"$old") <(containers_of "$svc" | sort))"
  [[ -n "$new" ]] || { log "$svc: no new container was started"; return 1; }
  for id in $new; do
    if ! wait_healthy "$id"; then
      # shellcheck disable=SC2086  # one id per word
      docker rm -f $new >/dev/null 2>&1 || true
      log "$svc: the new container did not become healthy; the running one keeps serving"
      return 1
    fi
  done
  if [[ "$svc" == api ]] && ! docker exec "$(head -n1 <<<"$new")" python -c \
      "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=5).status == 200 else 1)"; then
    # shellcheck disable=SC2086  # one id per word
    docker rm -f $new >/dev/null 2>&1 || true
    log "api: the new container is not ready (database or Valkey); the running one keeps serving"
    return 1
  fi
  SWITCHED=1
  if [[ -n "$old" ]]; then
    # shellcheck disable=SC2086  # one id per word
    docker stop -t 30 $old >/dev/null && docker rm $old >/dev/null
  fi
  log "$svc: switched to $tag"
}

# Starts or switches the whole stack to <tag>. SWITCHED=1 once any running service changed.
SWITCHED=0
start() {
  local tag="$1"
  if ! running api || ! running client || ! running caddy; then
    SWITCHED=1
    # First deployment (or the stack was stopped): nothing serves traffic yet.
    install_caddyfile "$tag"
    compose "$tag" up -d --wait --wait-timeout 180 --remove-orphans || return 1
    compose "$tag" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force >/dev/null
    return 0
  fi
  compose "$tag" up -d --no-deps --wait --wait-timeout 60 db valkey || return 1
  swap "$tag" api || return 1
  swap "$tag" client || return 1
  # Background services take no requests: replaced in place (Celery finishes running tasks;
  # exactly one beat must run).
  compose "$tag" up -d --no-deps --wait --wait-timeout 180 worker beat || return 1
  reload_caddy "$tag"
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

rollback() {
  if [[ -z "$PREV_TAG" || "$PREV_TAG" == "$NEW_TAG" ]]; then
    log "no previous release to restore — see docs/runbook.md (Recovery)"
    return 1
  fi
  log "restoring previous release $PREV_TAG"
  start "$PREV_TAG" && smoke && touch "$APP_DIR/releases/$PREV_TAG" && log "previous release $PREV_TAG restored"
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
  if ! compose "$NEW_TAG" pull --quiet api client; then
    log "pulling images failed; the running release was not changed"
    exit 1
  fi
fi

if [[ "$DEPLOYED_BEFORE" == 1 ]]; then
  log "$NEW_TAG was deployed here before: its migrations are already applied, skipping them"
else
  if ! dump_database; then
    log "database dump failed; the running release was not changed"
    exit 1
  fi
  # Migrations are backward compatible (backend standard), so the running release keeps working.
  log "running migrations"
  if ! compose "$NEW_TAG" --profile tools run --rm migrate; then
    log "migration failed; the running release was not changed"
    exit 1
  fi
fi

if start "$NEW_TAG" && smoke; then
  ln -sfn "releases/$NEW_TAG" "$APP_DIR/current"
  touch "$NEW_DIR"  # release order for cleanup = last time it became current
  grep -qxF "$NEW_TAG" "$HISTORY" 2>/dev/null || echo "$NEW_TAG" >> "$HISTORY"
  cleanup_old_releases
  # Dangling layers of Profilo's own images only (the server may host other projects).
  docker image prune -f --filter "label=org.opencontainers.image.source=https://github.com/MichalWrzesinski/Profilo" >/dev/null || true
  log "deployed $NEW_TAG"
  exit 0
fi

if [[ "$SWITCHED" == 0 ]]; then
  log "new release $NEW_TAG failed before taking traffic; the running release was not changed"
  exit 1
fi
log "new release $NEW_TAG failed"
rollback || log "rollback failed — manual action needed (docs/runbook.md, Recovery)"
exit 1
