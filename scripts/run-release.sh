#!/usr/bin/env bash
set -euo pipefail

: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

REPO="${GITHUB_REPOSITORY}"

# --- Function: check_required_checks_status ---
# Arguments: $1 = repo (owner/name), $2 = PR number
# Returns: 0 if all required checks passed
#          1 if required checks exist but are pending/failed
#          2 if required checks exist but none have started (PAT needed)
#          3 if no required checks configured
check_required_checks_status() {
  local repo="$1"
  local pr_number="$2"

  echo "DEBUG: Checking required checks status for $repo PR #$pr_number"

  # Get the latest commit SHA for this PR
  local head_sha
  head_sha=$(gh pr view "$pr_number" --repo "$repo" --json headRefOid --jq '.headRefOid') || return 3
  echo "DEBUG: head_sha=$head_sha"

  # List of required check names — add all that are marked "Required" in branch protection
  local required_checks=(
    "Tests / static-and-unit-tests"
    # Add more required check names here if needed
  )
  local total_required=${#required_checks[@]}
  if [[ "$total_required" -eq 0 ]]; then
    echo "DEBUG: No required checks configured in script."
    return 3
  fi

  # Retry loop to wait for ALL required checks to appear in /check-runs
  local checks_json attempt=1 max_attempts=10
  while ((attempt <= max_attempts)); do
    checks_json=$(gh api repos/"$repo"/commits/"$head_sha"/check-runs) || return 3
    local found_all=true
    for check_name in "${required_checks[@]}"; do
      local count
      count=$(echo "$checks_json" | jq --arg name "$check_name" '[.check_runs[] | select(.name==$name)] | length')
      if [[ "$count" -eq 0 ]]; then
        found_all=false
        break
      fi
    done
    if $found_all; then
      break
    fi
    echo "DEBUG: Attempt $attempt — not all required checks found yet, retrying..."
    sleep 3
    ((attempt++))
  done

  echo "DEBUG: Final check runs JSON after $attempt attempt(s):"
  echo "$checks_json" | jq .

  local passed_count=0
  local pending_count=0
  local failed_count=0

  for check_name in "${required_checks[@]}"; do
    local check_json
    check_json=$(echo "$checks_json" | jq --arg name "$check_name" '.check_runs | map(select(.name==$name))')
    local ok_count
    ok_count=$(echo "$check_json" | jq '[.[] | select(.status=="completed" and (.conclusion=="success" or .conclusion=="skipped" or .conclusion=="neutral"))] | length')
    local total_count
    total_count=$(echo "$check_json" | jq 'length')

    if [[ "$ok_count" -eq "$total_count" && "$total_count" -gt 0 ]]; then
      ((passed_count++))
    else
      local failed_here
      failed_here=$(echo "$check_json" | jq '[.[] | select(.status=="completed" and (.conclusion=="failure" or .conclusion=="timed_out" or .conclusion=="cancelled" or .conclusion=="action_required"))] | length')
      if [[ "$failed_here" -gt 0 ]]; then
        ((failed_count++))
      else
        ((pending_count++))
      fi
    fi
  done

  echo "DEBUG: total_required=$total_required passed_count=$passed_count pending_count=$pending_count failed_count=$failed_count"

  if [[ "$passed_count" -eq "$total_required" ]]; then
    return 0
  elif [[ "$pending_count" -gt 0 ]]; then
    return 1
  elif [[ "$failed_count" -gt 0 ]]; then
    return 1
  else
    # If we still somehow didn't find them but mergeStateStatus says BLOCKED, treat as PAT needed
    local merge_state
    merge_state=$(gh pr view "$pr_number" --repo "$repo" --json mergeStateStatus --jq '.mergeStateStatus')
    echo "DEBUG: mergeStateStatus=$merge_state"
    if [[ "${merge_state^^}" == "BLOCKED" ]]; then
      return 2
    else
      return 3
    fi
  fi
}

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
echo "$PR_URL"

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
    max_attempts=40 # ~10 minutes if sleep=15
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
