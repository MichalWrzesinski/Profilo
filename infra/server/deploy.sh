#!/usr/bin/env bash
# Deploys one release on this server and verifies it; on failure restores the previous
# release (its images *and* its stack files). Layout in /srv/profilo:
#   .env                     server-only settings and secrets (bootstrap.sh)
#   releases/<sha>/          compose.yml, Caddyfile, deploy.sh uploaded by the workflow
#   current -> releases/<sha>  last successful release
# Run as the deploy user:  /srv/profilo/releases/<sha>/deploy.sh <sha>
# DEPLOY_SKIP_PULL=1 skips pulling (local tests with preloaded images only).
set -euo pipefail

export APP_DIR="${APP_DIR:-/srv/profilo}"
KEEP_RELEASES=5
NEW_TAG="${1:?commit sha required}"
[[ "$NEW_TAG" =~ ^[0-9a-f]{7,40}$ ]] || { echo "invalid commit sha: $NEW_TAG" >&2; exit 2; }
NEW_DIR="$APP_DIR/releases/$NEW_TAG"
[[ -f "$NEW_DIR/compose.yml" && -f "$NEW_DIR/Caddyfile" ]] || { echo "release files missing in $NEW_DIR" >&2; exit 2; }

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

# One deployment at a time; keep going if the SSH session drops (output may be lost).
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || { echo "another deployment is running" >&2; exit 3; }
trap '' HUP

set -a
# shellcheck source=/dev/null
. "$APP_DIR/.env"
set +a
PREV_TAG=""
[[ -L "$APP_DIR/current" ]] && PREV_TAG="$(basename "$(readlink "$APP_DIR/current")")"
CURL_TLS=()
[[ "${TLS_MODE:-acme}" == internal ]] && CURL_TLS=(--insecure)

# compose <tag> <args…>: runs Compose with the release's own files.
compose() {
  local tag="$1"; shift
  IMAGE_TAG="$tag" docker compose --project-directory "$APP_DIR/releases/$tag" \
    -f "$APP_DIR/releases/$tag/compose.yml" "$@"
}

smoke() {
  # Retries for up to 90 s: Caddy may still be obtaining a certificate or starting.
  local deadline=$((SECONDS + 90)) path code
  for path in /ready /; do
    while true; do
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${CURL_TLS[@]}" \
        --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN$path" 2>/dev/null || echo 000)"
      [[ "$code" == 200 ]] && break
      if (( SECONDS >= deadline )); then
        log "smoke test failed: $path returned $code"
        return 1
      fi
      sleep 3
    done
  done
  log "smoke tests passed (/ready, /)"
}

start() {
  local tag="$1"
  compose "$tag" up -d --wait --wait-timeout 180 --remove-orphans || return 1
  # Apply Caddyfile changes even when Compose did not recreate the container.
  compose "$tag" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force >/dev/null
}

rollback() {
  if [[ -z "$PREV_TAG" || "$PREV_TAG" == "$NEW_TAG" ]]; then
    log "no previous release to restore — see docs/runbook.md (Recovery)"
    return 1
  fi
  log "restoring previous release $PREV_TAG"
  start "$PREV_TAG" && smoke && log "previous release $PREV_TAG restored"
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

log "deploying $NEW_TAG (previous: ${PREV_TAG:-none})"
if [[ "${DEPLOY_SKIP_PULL:-0}" != 1 ]]; then
  if ! compose "$NEW_TAG" pull --quiet api client; then
    log "pulling images failed; the running release was not changed"
    exit 1
  fi
fi

# Migrations are backward compatible (backend standard), so the running release keeps working.
log "running migrations"
if ! compose "$NEW_TAG" --profile tools run --rm migrate; then
  log "migration failed; the running release was not changed"
  exit 1
fi

if start "$NEW_TAG" && smoke; then
  ln -sfn "releases/$NEW_TAG" "$APP_DIR/current"
  cleanup_old_releases
  log "deployed $NEW_TAG"
  exit 0
fi

log "new release $NEW_TAG failed"
rollback || log "rollback failed — manual action needed (docs/runbook.md, Recovery)"
exit 1
