#!/usr/bin/env bash
set -euo pipefail

: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

REPO="${GITHUB_REPOSITORY}"

# --- Decide which token to use ---
if [[ -n "${RELEASE_PAT:-}" ]]; then
  echo "PAT provided. Using PAT for GitHub CLI and API calls."
  export GH_TOKEN="$RELEASE_PAT"
  USING_PAT=true
else
  echo "No PAT provided. Using the Actions-provided GITHUB_TOKEN."
  export GH_TOKEN="$GITHUB_TOKEN"
  USING_PAT=false
fi
# --- Function: check_required_checks_status ---
# Arguments: $1 = repo (owner/name), $2 = PR number
# Returns: 0 if all required checks passed
#          1 if required checks exist but are pending/failed (incl. required skipped)
#          2 if required checks exist but none have started OR cannot be determined
#          3 if no required checks configured
check_required_checks_status() {
  local repo="$1"
  local pr_number="$2"

  echo "DEBUG: Checking required checks status for $repo PR #$pr_number"

  # Get PR head SHA and base branch
  local head_sha base_branch
  head_sha=$(gh pr view "$pr_number" --repo "$repo" --json headRefOid --jq '.headRefOid') || {
    echo "DEBUG: Failed to read head SHA"
    return 3
  }
  base_branch=$(gh pr view "$pr_number" --repo "$repo" --json baseRefName --jq '.baseRefName') || {
    echo "DEBUG: Failed to read base branch"
    return 3
  }
  echo "DEBUG: head_sha=$head_sha base_branch=$base_branch"

  # ------------------------------------------------------------
  # 1) Discover required checks (branch protection → statuses)
  # ------------------------------------------------------------

  # Branch protection API (raw + parsed)
  local bp_stdout_file bp_stderr_file bp_rc
  bp_stdout_file=$(mktemp) bp_stderr_file=$(mktemp)
  echo "DEBUG: api call for repos/$repo/branches/$base_branch/protection"
  gh api "repos/$repo/branches/$base_branch/protection" 1> "$bp_stdout_file" 2> "$bp_stderr_file"
  bp_rc=$?
  echo "DEBUG: branch_protection_api_rc=$bp_rc"
  echo "DEBUG: branch_protection_raw_stdout:"
  cat "$bp_stdout_file"
  echo "DEBUG: branch_protection_raw_stderr:"
  cat "$bp_stderr_file"

  local bp_contexts_json=""
  local -a bp_contexts=()
  if [[ $bp_rc -eq 0 ]]; then
    bp_contexts_json=$(jq -c '.required_status_checks.contexts // []' < "$bp_stdout_file" 2> /dev/null || echo "[]")
    mapfile -t bp_contexts < <(echo "$bp_contexts_json" | jq -r '.[]')
  fi
  echo "DEBUG: branch_protection_parsed_contexts=$bp_contexts_json"

  # Commit statuses API (raw + parsed) — always fetch for evaluation/fallback
  local st_stdout_file st_stderr_file st_rc
  st_stdout_file=$(mktemp) st_stderr_file=$(mktemp)
  echo "DEBUG: api call for repos/$repo/commits/$head_sha/status"
  gh api "repos/$repo/commits/$head_sha/status" 1> "$st_stdout_file" 2> "$st_stderr_file"
  st_rc=$?
  echo "DEBUG: statuses_api_rc=$st_rc"
  echo "DEBUG: statuses_raw_stdout:"
  cat "$st_stdout_file"
  echo "DEBUG: statuses_raw_stderr:"
  cat "$st_stderr_file"

  local st_contexts_json=""
  local -a st_contexts=()
  if [[ $st_rc -eq 0 ]]; then
    # Unique list of contexts present on this commit
    st_contexts_json=$(jq -c '[.statuses[].context] | unique' < "$st_stdout_file" 2> /dev/null || echo "[]")
    mapfile -t st_contexts < <(echo "$st_contexts_json" | jq -r '.[]')
  fi
  echo "DEBUG: statuses_parsed_contexts=$st_contexts_json"

  # Decide required set source
  local source="none"
  local -a required_checks=()
  if [[ $bp_rc -eq 0 ]]; then
    source="branch_protection"
    required_checks=("${bp_contexts[@]}")
  elif [[ ${#st_contexts[@]} -gt 0 ]]; then
    source="commit_statuses_fallback"
    required_checks=("${st_contexts[@]}")
  fi
  echo "DEBUG: required_source=$source required_checks_list=${required_checks[*]} total_required=${#required_checks[@]}"

  # If branch protection is readable and reports zero contexts → definitively no required checks
  if [[ "$source" == "branch_protection" && ${#required_checks[@]} -eq 0 ]]; then
    echo "DEBUG: Decision: return 3 (branch protection reports no required status checks)."
    rm -f "$bp_stdout_file" "$bp_stderr_file" "$st_stdout_file" "$st_stderr_file"
    return 3
  fi

  # If we cannot determine any required checks from either API → do not proceed
  if [[ ${#required_checks[@]} -eq 0 ]]; then
    echo "DEBUG: Decision: return 2 (cannot determine required checks from branch protection or commit statuses)."
    rm -f "$bp_stdout_file" "$bp_stderr_file" "$st_stdout_file" "$st_stderr_file"
    return 2
  fi

  # ------------------------------------------------------------
  # 2) Wait (max ~2 minutes) for checks to register on the commit
  #    A context counts as "found" if:
  #      - a check-run with matching .name or .external_id exists, OR
  #      - a status with matching .context exists
  # ------------------------------------------------------------
  local checks_json="" attempt=1 max_attempts=12
  local cr_stdout_file cr_stderr_file
  cr_stdout_file=$(mktemp) cr_stderr_file=$(mktemp)

  while ((attempt <= max_attempts)); do
    # Refresh both check-runs and statuses so we can consider either signal
    : > "$cr_stdout_file"
    : > "$cr_stderr_file"
    echo "DEBUG: api call for repos/$repo/commits/$head_sha/check-runs"
    gh api "repos/$repo/commits/$head_sha/check-runs" 1> "$cr_stdout_file" 2> "$cr_stderr_file"
    local cr_rc=$?
    local found_all=true

    # Debug per-attempt summary (do not dump raw every time)
    local total_runs="n/a"
    if [[ $cr_rc -eq 0 ]]; then
      total_runs=$(jq -r '.total_count' < "$cr_stdout_file" 2> /dev/null || echo "parse_error")
    fi

    # Reuse last statuses payload; it’s already fetched. That’s sufficient to decide "found" set.
    for ctx in "${required_checks[@]}"; do
      local found_for_ctx=0
      if [[ $cr_rc -eq 0 ]]; then
        local count_runs
        count_runs=$(jq --arg name "$ctx" '[.check_runs[] | select(.name==$name or .external_id==$name)] | length' < "$cr_stdout_file" 2> /dev/null || echo "0")
        if [[ "$count_runs" =~ ^[0-9]+$ ]] && ((count_runs > 0)); then
          found_for_ctx=1
        fi
      fi
      if ((found_for_ctx == 0 && st_rc == 0)); then
        local count_statuses
        count_statuses=$(jq --arg name "$ctx" '[.statuses[] | select(.context==$name)] | length' < "$st_stdout_file" 2> /dev/null || echo "0")
        if [[ "$count_statuses" =~ ^[0-9]+$ ]] && ((count_statuses > 0)); then
          found_for_ctx=1
        fi
      fi
      if ((found_for_ctx == 0)); then
        found_all=false
        break
      fi
    done

    if $found_all; then
      break
    fi

    echo "DEBUG: Attempt $attempt — total_check_runs=$total_runs — not all required contexts present yet; retrying..."
    sleep 10
    ((attempt++))
  done

  # If we timed out waiting for contexts to appear, stop here
  if ((attempt > max_attempts)); then
    echo "DEBUG: Timed out after $((max_attempts * 3))s waiting for required contexts to appear."
    echo "DEBUG: Last check-runs raw stdout:"
    cat "$cr_stdout_file"
    echo "DEBUG: Last check-runs raw stderr:"
    cat "$cr_stderr_file"
    echo "DEBUG: statuses (for reference):"
    cat "$st_stdout_file"
    rm -f "$bp_stdout_file" "$bp_stderr_file" "$st_stdout_file" "$st_stderr_file" "$cr_stdout_file" "$cr_stderr_file"
    return 2
  fi

  echo "DEBUG: Final check-runs raw stdout after $attempt attempt(s):"
  cat "$cr_stdout_file"
  echo "DEBUG: Final check-runs raw stderr:"
  cat "$cr_stderr_file"

  # ------------------------------------------------------------
  # 3) Evaluate each required context
  #    Rule: required 'skipped' = failure (abort)
  # ------------------------------------------------------------
  local passed_count=0 pending_count=0 failed_count=0

  for ctx in "${required_checks[@]}"; do
    # Prefer check-runs if present
    local runs_json
    runs_json=$(jq --arg name "$ctx" '.check_runs | map(select(.name==$name or .external_id==$name))' < "$cr_stdout_file" 2> /dev/null || echo "[]")
    local runs_len
    runs_len=$(echo "$runs_json" | jq 'length' 2> /dev/null || echo "0")

    if [[ "$runs_len" =~ ^[0-9]+$ ]] && ((runs_len > 0)); then
      echo "DEBUG: evaluating_ctx=$ctx via check-runs payload: $runs_json"

      local skipped_here
      skipped_here=$(echo "$runs_json" | jq '[.[] | select(.status=="completed" and .conclusion=="skipped")] | length' 2> /dev/null || echo "0")
      if ((skipped_here > 0)); then
        echo "DEBUG: ctx=$ctx decision=failed reason=required_check_skipped"
        ((failed_count++))
        continue
      fi

      local ok_here
      ok_here=$(echo "$runs_json" | jq '[.[] | select(.status=="completed" and (.conclusion=="success" or .conclusion=="neutral"))] | length' 2> /dev/null || echo "0")
      if ((ok_here == runs_len)); then
        echo "DEBUG: ctx=$ctx decision=passed via check-runs"
        ((passed_count++))
        continue
      fi

      local fail_here
      fail_here=$(echo "$runs_json" | jq '[.[] | select(.status=="completed" and (.conclusion=="failure" or .conclusion=="timed_out" or .conclusion=="cancelled" or .conclusion=="action_required"))] | length' 2> /dev/null || echo "0")
      if ((fail_here > 0)); then
        echo "DEBUG: ctx=$ctx decision=failed via check-runs"
        ((failed_count++))
      else
        echo "DEBUG: ctx=$ctx decision=pending via check-runs"
        ((pending_count++))
      fi

    else
      # Fallback to statuses for this context
      local latest_state
      latest_state=$(jq -r --arg name "$ctx" '[.statuses[] | select(.context==$name)] | sort_by(.updated_at) | last | .state // ""' < "$st_stdout_file" 2> /dev/null || echo "")
      echo "DEBUG: evaluating_ctx=$ctx via statuses state=$latest_state"
      case "$latest_state" in
        success)
          echo "DEBUG: ctx=$ctx decision=passed via statuses"
          ((passed_count++))
          ;;
        failure | error)
          echo "DEBUG: ctx=$ctx decision=failed via statuses"
          ((failed_count++))
          ;;
        pending | "")
          echo "DEBUG: ctx=$ctx decision=pending via statuses"
          ((pending_count++))
          ;;
      esac
    fi
  done

  echo "DEBUG: summary total_required=${#required_checks[@]} passed_count=$passed_count pending_count=$pending_count failed_count=$failed_count"

  rm -f "$bp_stdout_file" "$bp_stderr_file" "$st_stdout_file" "$st_stderr_file" "$cr_stdout_file" "$cr_stderr_file"

  if ((passed_count == ${#required_checks[@]})); then
    echo "DEBUG: Decision: return 0 (all required checks passed)."
    return 0
  fi
  if ((failed_count > 0)); then
    echo "DEBUG: Decision: return 1 (one or more required checks failed or were skipped)."
    return 1
  fi
  if ((pending_count > 0)); then
    echo "DEBUG: Decision: return 1 (one or more required checks still pending)."
    return 1
  fi

  echo "DEBUG: Decision: return 3 (unexpected state; treating as no required checks)."
  return 3
}

# --- Run semantic-release to export version, notes, and branch ---
export release_step=create_release_files
npx semantic-release --no-ci --dry-run --extends ./release.config.js

VERSION=$(cat version.txt)
DEFAULT_BRANCH=$(cat branch.txt) # authoritative from plugin for versioning

if [[ -z "$VERSION" ]]; then
  echo "No release necessary."
  exit 0
fi

# --- Record the base SHA of the default branch before we start ---
git fetch origin "$DEFAULT_BRANCH"
BASE_SHA=$(git rev-parse "origin/${DEFAULT_BRANCH}")

# --- Create ephemeral branch from the default branch ---
TEMP_BRANCH="temp_release_${GITHUB_RUN_ID}_${GITHUB_RUN_NUMBER}"
echo "=== Creating ephemeral release branch: $TEMP_BRANCH from $DEFAULT_BRANCH ==="
git checkout -b "$TEMP_BRANCH" "origin/${DEFAULT_BRANCH}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

NOTES_FILE="notes.md"

echo "=== Updating $CHANGELOG_FILE and package.json ==="
node ./scripts/write-changes-md.js "$VERSION" "$NOTES_FILE" "$CHANGELOG_FILE"

if [[ "$RUN_PRETTIER_ON_CHANGELOG" == "true" ]]; then
  echo "=== Formatting $CHANGELOG_FILE with Prettier ==="
  if npx --no-install prettier --version > /dev/null 2>&1; then
    npx --no-install prettier --write "$CHANGELOG_FILE"
  else
    npx prettier --write "$CHANGELOG_FILE"
  fi
fi

node ./scripts/update-version.js "$VERSION"

git add "$CHANGELOG_FILE" package.json package-lock.json 2> /dev/null || git add "$CHANGELOG_FILE" package.json
git commit -m "chore(release): ${VERSION}" || true

echo "=== Pushing ephemeral branch ==="
git push origin "$TEMP_BRANCH" --force

# --- Create PR ---
PR_BODY=$(
  cat << EOF
Automated release PR for version ${VERSION} (changelog + package.json version bump).

This pull request was created by the semantic-auto-release workflow.
EOF
)

echo "=== Creating PR into $DEFAULT_BRANCH ==="
PR_URL=$(gh pr create \
  --base "$DEFAULT_BRANCH" \
  --head "$TEMP_BRANCH" \
  --title "chore(release): ${VERSION}" \
  --body "$PR_BODY")
echo "DEBUG: PR URL $PR_URL"

PR_NUMBER=$(gh pr view "$PR_URL" --json number --jq '.number')

# --- Merge logic with required checks detection ---
status_code=3
check_required_checks_status "$REPO" "$PR_NUMBER" || status_code=$?

case $status_code in
  0)
    echo "All required checks passed — proceeding to merge."
    ;;
  1)
    echo "Required checks are still pending — waiting for them to pass..."
    max_attempts=8 # ~10 minutes if sleep=15
    attempt=1
    while ((attempt <= max_attempts)); do
      sleep 15
      check_required_checks_status "$REPO" "$PR_NUMBER" || status_code=$?
      if [[ $status_code -eq 0 ]]; then
        echo "All required checks passed on attempt $attempt."
        break
      fi
      echo "Attempt $attempt: checks still pending..."
      ((attempt++))
    done
    if [[ $status_code -ne 0 ]]; then
      echo "ERROR: Required checks did not pass within the timeout."
      exit 1
    fi
    ;;
  2)
    echo -e "\033[1;31mERROR:\033[0m Required checks never started - likely due to checks on a protected branch with the current scope."
    echo -e "Set \033[1;34mRELEASE_PAT\033[0m to a fine-grained personal access token with 'Contents: Read & write' and 'Pull requests: Read & write' permissions."
    exit 1
    ;;
  3)
    echo "No required checks configured — proceeding."
    ;;
esac

echo "=== Merging PR ==="
gh pr merge "$PR_NUMBER" --squash

echo "=== Syncing $DEFAULT_BRANCH branch after merge ==="
git fetch origin "$DEFAULT_BRANCH"
git checkout "$DEFAULT_BRANCH"
git pull --ff-only origin "$DEFAULT_BRANCH"

# --- Check if the repo's default branch has commits beyond our release commit ---
NEW_COMMITS=$(git rev-list --count "${BASE_SHA}..HEAD")
if [[ "$NEW_COMMITS" -gt 1 ]]; then
  echo "ERROR: $DEFAULT_BRANCH has new commits since release calculation. Aborting."
  exit 1
fi

echo "=== Tagging and publishing ==="
git tag "v$VERSION"
git push origin "v$VERSION"

if [ -f .npmrc ]; then
  grep -v '//registry.npmjs.org/:_authToken=' .npmrc > .npmrc.tmp && mv .npmrc.tmp .npmrc
fi
cat << EOF >> ~/.npmrc
registry=https://registry.npmjs.org/
always-auth=true
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
EOF

npm publish --access public

echo "=== Creating GitHub Release ==="
gh release create "v${VERSION}" \
  --title "v${VERSION}" \
  --notes-file notes.md

echo "=== Cleanup: deleting ephemeral branch from remote ==="
if git ls-remote --exit-code --heads origin "$TEMP_BRANCH" > /dev/null 2>&1; then
  git push origin --delete "$TEMP_BRANCH" || echo "Warning: could not delete branch $TEMP_BRANCH"
else
  echo "Branch $TEMP_BRANCH already deleted on remote."
fi
