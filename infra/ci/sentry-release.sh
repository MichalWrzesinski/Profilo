#!/usr/bin/env bash
# Runs in the deploy workflows after a successful deployment (TASK-023): creates the Sentry
# release for the commit, uploads the client's source maps from the published client image
# (they are in the image but not served) and records the deployment for the environment.
# Never in ci.yml (AGENTS.md). Without a token it is skipped, unless SENTRY_REQUIRED=true.
#
#   SHA ENV_NAME SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT [SENTRY_URL] [SENTRY_REQUIRED]
#   GHCR_USER GHCR_TOKEN (pulling the client image)
set -euo pipefail

CLI_IMAGE=getsentry/sentry-cli:3.8.1@sha256:9b5edc78fc946050e833e745041a9e63568ab410b02f03245ca835d5724e71b2
fail() { echo "::error::$*"; exit 1; }

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  [[ "${SENTRY_REQUIRED:-false}" == true ]] && fail "a Sentry token is required for $ENV_NAME (docs/runbook.md, Monitoring)"
  echo "::notice::no Sentry token for $ENV_NAME: release and source maps not uploaded"
  exit 0
fi
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail "invalid commit SHA"
[[ "${SENTRY_ORG:-}" =~ ^[a-z0-9_-]+$ && "${SENTRY_PROJECT:-}" =~ ^[a-z0-9_-]+$ ]] \
  || fail "SENTRY_ORG and SENTRY_PROJECT must be Sentry slugs"
url="${SENTRY_URL:-https://de.sentry.io/}"
[[ "$url" =~ ^https://[a-z0-9.-]+/?$ ]] || fail "invalid SENTRY_URL"

work="$(mktemp -d)"
trap 'rm -rf "$work"; docker rm -f profilo-sourcemaps >/dev/null 2>&1 || true' EXIT

echo "::group::Source maps from the client image"
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
image="ghcr.io/michalwrzesinski/profilo-client:$SHA"
docker pull --quiet "$image" >/dev/null
docker logout ghcr.io >/dev/null
docker create --name profilo-sourcemaps "$image" >/dev/null
# Scripts (with debug IDs) and their maps side by side, as sentry-cli expects them. Images
# built before TASK-023 (a rollback, an old staging commit) have no maps: release only.
maps=true
docker cp profilo-sourcemaps:/app/client/.next/static "$work/static"
if ! docker cp profilo-sourcemaps:/opt/sourcemaps/. "$work/static/" 2>/dev/null; then
  maps=false
  echo "::notice::the client image of $SHA has no source maps (built before TASK-023)"
fi
echo "$(find "$work/static" -name '*.map' | wc -l) source maps"
echo "::endgroup::"

cli() {
  docker run --rm -e SENTRY_AUTH_TOKEN -e SENTRY_ORG -e SENTRY_PROJECT -e SENTRY_URL="$url" \
    -v "$work:/work" -w /work "$CLI_IMAGE" "$@"
}
echo "::group::Sentry release $SHA ($ENV_NAME)"
cli releases new "$SHA"
# Links the release to the commit (needs the GitHub integration in Sentry; optional).
cli releases set-commits "$SHA" --commit "MichalWrzesinski/Profilo@$SHA" \
  || echo "::warning::commits not linked (Sentry GitHub integration missing?)"
[[ "$maps" == true ]] && cli sourcemaps upload --release "$SHA" static
cli releases finalize "$SHA"
cli deploys new --release "$SHA" -e "$ENV_NAME"
echo "::endgroup::"
