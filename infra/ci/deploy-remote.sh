#!/usr/bin/env bash
# Runs in GitHub Actions (deploy-staging, deploy-production, rollback-production): uploads the
# stack files of one commit to the server, writes the runtime secrets, runs deploy.sh there
# and checks the site from outside. The calling workflow checks out that commit and passes
# everything as environment variables; only those workflows reference deployment secrets.
#
#   MODE           deploy | rollback (rollback: only a commit deployed on that server before)
# deploy.sh and the stack files come from the deployed commit (they are one contract); this
# script always comes from main.
#   ENV_NAME       staging | production (messages only)
#   SHA DOMAIN SSH_HOST SSH_USER APP_DIR SSH_KEY KNOWN_HOSTS
#   SMTP_HOST SMTP_PORT SMTP_SECURITY SMTP_USERNAME SMTP_PASSWORD MAIL_FROM
#   GHCR_USER GHCR_TOKEN
#   Off-site backups (production): BACKUP_REQUIRED (true: fail without them),
#   BACKUP_REPOSITORY (sftp:user@host:/path), BACKUP_SFTP_PORT, BACKUP_SSH_KEY,
#   BACKUP_KNOWN_HOSTS, BACKUP_PASSWORD (restic encryption key), ALERT_EMAIL
set -euo pipefail

fail() { echo "::error::$*"; exit 1; }
group() { echo "::group::$*"; }
endgroup() { echo "::endgroup::"; }

[[ "${MODE:-}" =~ ^(deploy|rollback)$ ]] || fail "MODE must be deploy or rollback"
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail "invalid commit SHA"
[[ -n "${DOMAIN:-}" && -n "${SSH_HOST:-}" && -n "${SSH_KEY:-}" && -n "${KNOWN_HOSTS:-}" ]] \
  || fail "domain, SSH host, key or known hosts missing for $ENV_NAME (docs/runbook.md)"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+$ ]] || fail "invalid domain"
[[ "${SSH_USER:-}" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || fail "invalid SSH user"
[[ "${APP_DIR:-}" =~ ^/srv/[A-Za-z0-9._-]+$ ]] || fail "the app directory must be a directory directly in /srv"
[[ -n "${SMTP_USERNAME:-}" && -n "${SMTP_PASSWORD:-}" && -n "${MAIL_FROM:-}" ]] \
  || fail "SMTP username, password or sender missing for $ENV_NAME (docs/runbook.md)"
[[ "${SMTP_HOST:-}" =~ ^[A-Za-z0-9.-]+$ && "${SMTP_PORT:-}" =~ ^[0-9]{2,5}$ ]] || fail "invalid SMTP host or port"
# Single-quoted in the env file (taken literally: `$`, `#` and spaces are safe).
for value in "$SMTP_USERNAME" "$SMTP_PASSWORD" "$MAIL_FROM"; do
  [[ "$value" != *"'"* && "$value" != *$'\n'* ]] || fail "SMTP values must not contain ' or a line break"
done
case "${SMTP_SECURITY:-}" in
  starttls) tls=(SMTP_STARTTLS=true SMTP_SSL=false) ;;
  ssl) tls=(SMTP_STARTTLS=false SMTP_SSL=true) ;;
  *) fail "SMTP security must be starttls or ssl" ;;
esac
[[ "$GHCR_USER" =~ ^[A-Za-z0-9-]+$ ]] || fail "invalid GHCR user"
backups=false
if [[ -n "${BACKUP_REPOSITORY:-}" ]]; then
  [[ "$BACKUP_REPOSITORY" =~ ^sftp:[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:/[A-Za-z0-9._/-]+$ ]] \
    || fail "the backup repository must look like sftp:user@host:/path"
  [[ "${BACKUP_SFTP_PORT:-23}" =~ ^[0-9]{1,5}$ ]] || fail "invalid backup SFTP port"
  [[ -n "${BACKUP_SSH_KEY:-}" && -n "${BACKUP_KNOWN_HOSTS:-}" && -n "${BACKUP_PASSWORD:-}" ]] \
    || fail "backup SSH key, known hosts or encryption key missing for $ENV_NAME (docs/runbook.md)"
  [[ "${ALERT_EMAIL:-}" =~ ^[^@[:space:]\']+@[^@[:space:]\']+$ ]] || fail "invalid or missing alert e-mail address"
  backups=true
elif [[ "${BACKUP_REQUIRED:-false}" == true ]]; then
  fail "off-site backups are required for $ENV_NAME: set the backup repository (docs/runbook.md)"
fi

group "SSH (pinned host key)"
install -d -m 700 ~/.ssh
printf '%s\n' "$SSH_KEY" > ~/.ssh/id_ed25519
printf '%s\n' "$KNOWN_HOSTS" > ~/.ssh/known_hosts
chmod 600 ~/.ssh/id_ed25519 ~/.ssh/known_hosts
printf 'Host server\n  HostName %s\n  User %s\n  IdentityFile ~/.ssh/id_ed25519\n  StrictHostKeyChecking yes\n' \
  "$SSH_HOST" "$SSH_USER" > ~/.ssh/config
endgroup

# SHA and APP_DIR are validated above, so expanding them on the client side is safe.
# shellcheck disable=SC2029
{
  # A deployment still running on the server (e.g. after a dropped connection) must not have
  # its files or secrets replaced under it.
  ssh server "flock -n '$APP_DIR/.deploy.lock' true" \
    || fail "a deployment is still running on the $ENV_NAME server; wait for it and check releases/*/deploy.log"
  group "Upload stack files of $SHA"
  ssh server "mkdir -p '$APP_DIR/releases/$SHA'"
  scp -q infra/server/compose.yml infra/server/compose.proxied.yml infra/server/Caddyfile \
    infra/server/deploy.sh "server:$APP_DIR/releases/$SHA/"
  endgroup

  # Runtime secrets reach the server only through the deploy workflows (AGENTS.md).
  group "Runtime secrets"
  printf '%s\n' \
    "SMTP_HOST=$SMTP_HOST" "SMTP_PORT=$SMTP_PORT" "${tls[@]}" \
    "SMTP_USERNAME='$SMTP_USERNAME'" "SMTP_PASSWORD='$SMTP_PASSWORD'" "MAIL_FROM='$MAIL_FROM'" \
    | ssh server "umask 077 && cat > '$APP_DIR/.env.secrets'"
  endgroup

  # Backup settings and keys: a directory of their own, read-only in the backup container.
  # Without settings any earlier ones are removed, so the backup service stops (deploy.sh).
  if [[ "$backups" == true ]]; then
    group "Backup settings and keys"
    ssh server "umask 077 && mkdir -p '$APP_DIR/backup/keys'"
    printf '%s\n' "$BACKUP_SSH_KEY" | ssh server "umask 077 && cat > '$APP_DIR/backup/keys/ssh_key'"
    printf '%s\n' "$BACKUP_KNOWN_HOSTS" | ssh server "umask 077 && cat > '$APP_DIR/backup/keys/known_hosts'"
    printf '%s' "$BACKUP_PASSWORD" | ssh server "umask 077 && cat > '$APP_DIR/backup/keys/restic-password'"
    printf '%s\n' "BACKUP_REPOSITORY=$BACKUP_REPOSITORY" "BACKUP_SFTP_PORT=${BACKUP_SFTP_PORT:-23}" \
      "ALERT_EMAIL=$ALERT_EMAIL" | ssh server "umask 077 && cat > '$APP_DIR/backup/config'"
    endgroup
  else
    ssh server "rm -f '$APP_DIR/backup/config'"
  fi

  # Short-lived registry login with the workflow's own token; logged out whatever happens.
  printf '%s' "$GHCR_TOKEN" | ssh server "docker login ghcr.io -u '$GHCR_USER' --password-stdin" >/dev/null
  trap 'ssh server "docker logout ghcr.io" >/dev/null 2>&1 || true' EXIT

  option=""
  [[ "$MODE" == rollback ]] && option="--rollback"
  group "deploy.sh $SHA $option"
  status=0
  ssh server "APP_DIR='$APP_DIR' '$APP_DIR/releases/$SHA/deploy.sh' $SHA $option" || status=$?
  endgroup
}
case "$status" in
  0) ;;
  4) fail "$SHA was never deployed to $ENV_NAME; rollback accepts only earlier releases" ;;
  *) fail "deployment to $ENV_NAME failed (deploy.sh exit $status); see the log above" ;;
esac

group "External smoke tests"
for path in /ready /; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMAIN$path") || true
  [[ "$code" == 200 ]] || fail "$path returned $code"
done
headers=$(curl -sS -D - -o /dev/null --max-time 15 "http://$DOMAIN/") || true
grep -qiE '^HTTP/[0-9.]+ 30[18]' <<<"$headers" || fail "HTTP does not redirect"
grep -qi '^location: https://' <<<"$headers" || fail "redirect is not to HTTPS"
secure=$(curl -sS -D - -o /dev/null --max-time 15 "https://$DOMAIN/") || true
for h in strict-transport-security content-security-policy x-content-type-options referrer-policy; do
  grep -qi "^$h:" <<<"$secure" || fail "missing header $h"
done
endgroup
echo "$ENV_NAME serves $SHA at https://$DOMAIN"
