#!/usr/bin/env bash
# Repository settings as code (docs/standards/design/project-setup.md).
# Idempotent: safe to run again. Run by the repository owner:  scripts/setup-github.sh
set -euo pipefail

REPO="${REPO:-MichalWrzesinski/profilo}"
BRANCH="${BRANCH:-main}"
REQUIRED_CHECK="${REQUIRED_CHECK:-check}"
PROD_REVIEWER="${PROD_REVIEWER:-MichalWrzesinski}"

warn() { echo "WARN: $*" >&2; }
step() { echo "==> $*"; }

step "Merge settings: merge commit only, delete branches after merge"
gh api -X PATCH "repos/$REPO" \
  -F allow_merge_commit=true -F allow_squash_merge=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F allow_auto_merge=false >/dev/null

step "Branch protection on $BRANCH: PR only, required check '$REQUIRED_CHECK', no force push or deletion"
gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" --input - >/dev/null <<JSON || warn "Branch protection failed (private repos on a free personal plan need GitHub Pro). Apply manually or upgrade."
{
  "required_status_checks": { "strict": true, "checks": [ { "context": "$REQUIRED_CHECK" } ] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": false, "require_code_owner_reviews": false },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false
}
JSON

step "Environment: staging (no approval)"
gh api -X PUT "repos/$REPO/environments/staging" >/dev/null

step "Environment: production (approval by $PROD_REVIEWER)"
REVIEWER_ID="$(gh api "users/$PROD_REVIEWER" --jq .id)"
# Mode without an agent account: the owner both starts and approves production deployments,
# so self-review prevention stays off (see AGENTS.md overrides).
gh api -X PUT "repos/$REPO/environments/production" --input - >/dev/null <<JSON || warn "Production environment protection failed (required reviewers on private repos need GitHub Pro/Team)."
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [ { "type": "User", "id": $REVIEWER_ID } ],
  "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false }
}
JSON

step "Security: vulnerability alerts, Dependabot security updates, secret scanning"
gh api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null || warn "Vulnerability alerts not enabled."
gh api -X PUT "repos/$REPO/automated-security-fixes" >/dev/null || warn "Dependabot security updates not enabled."
gh api -X PATCH "repos/$REPO" --input - >/dev/null <<JSON || warn "Secret scanning not available for this repository."
{ "security_and_analysis": { "secret_scanning": { "status": "enabled" }, "secret_scanning_push_protection": { "status": "enabled" } } }
JSON

step "Done. Agent account: none (mode without an agent account, see AGENTS.md)."
