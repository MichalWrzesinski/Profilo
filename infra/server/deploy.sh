#!/usr/bin/env bash
# Deploys images of one commit on this server and verifies them; restores the previous
# version when the new one fails. Run as the deploy user in /srv/profilo:
#   ./deploy.sh <commit-sha>
# DEPLOY_SKIP_PULL=1 skips pulling (local tests with preloaded images only).
set -euo pipefail
cd "$(dirname "$0")"

NEW_TAG="${1:?commit sha required}"
[[ "$NEW_TAG" =~ ^[0-9a-f]{7,40}$ ]] || { echo "invalid commit sha: $NEW_TAG" >&2; exit 2; }
set -a
# shellcheck source=/dev/null
. ./.env
set +a
PREV_TAG="$(cat .deployed-tag 2>/dev/null || true)"
CURL_TLS=()
[[ "${TLS_MODE:-acme}" == internal ]] && CURL_TLS=(--insecure)

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

compose() { IMAGE_TAG="$1" docker compose "${@:2}"; }

smoke() {
  local url="https://$DOMAIN"
  for path in /ready /; do
    local code
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${CURL_TLS[@]}" \
      --resolve "$DOMAIN:443:127.0.0.1" "$url$path" || echo 000)"
    if [[ "$code" != 200 ]]; then
      log "smoke test failed: $path returned $code"
      return 1
    fi
  done
  log "smoke tests passed (/ready, /)"
}

start() { compose "$1" up -d --wait --wait-timeout 180 --remove-orphans; }

rollback() {
  if [[ -z "$PREV_TAG" ]]; then
    log "no previous version to restore"
    return 1
  fi
  log "restoring previous version $PREV_TAG"
  start "$PREV_TAG" && smoke && log "previous version $PREV_TAG restored"
}

log "deploying $NEW_TAG (previous: ${PREV_TAG:-none})"
if [[ "${DEPLOY_SKIP_PULL:-0}" != 1 ]]; then
  compose "$NEW_TAG" pull --quiet api client
fi

# Migrations are backward compatible (backend standard), so the running version keeps working.
log "running migrations"
if ! compose "$NEW_TAG" --profile tools run --rm migrate; then
  log "migration failed; the running version was not changed"
  exit 1
fi

if start "$NEW_TAG" && smoke; then
  echo "$NEW_TAG" > .deployed-tag
  docker image prune -af --filter "until=168h" >/dev/null || true
  log "deployed $NEW_TAG"
  exit 0
fi

log "new version $NEW_TAG failed"
rollback || log "rollback failed — manual action needed (docs/runbook.md)"
exit 1
