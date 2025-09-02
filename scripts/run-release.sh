#!/usr/bin/env bash
set -euo pipefail

: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

REPO="${GITHUB_REPOSITORY}"

# --- Function: check_required_checks_status ---
# Arguments: $1 = repo (owner/name), $2 = PR number
# Returns: 0 if all required checks passed
#          1 if required checks exist but are pending
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

  # Fetch combined status + check runs for that commit
  local status_json checks_json
  status_json=$(gh api repos/"$repo"/commits/"$head_sha"/status) || return 3
  checks_json=$(gh api repos/"$repo"/commits/"$head_sha"/check-runs) || return 3

  echo "DEBUG: Combined status JSON:"
  echo "$status_json" | jq .
  echo "DEBUG: Check runs JSON:"
  echo "$checks_json" | jq .

  local total_required passed total_runs
  total_required=$(echo "$status_json" | jq '[.statuses[] | select(.context != null)] | length')
  passed=$(echo "$status_json" | jq '[.statuses[] | select(.state == "success")] | length')
  total_runs=$(echo "$checks_json" | jq '.total_count')

  echo "DEBUG: total_required=$total_required"
  echo "DEBUG: passed=$passed"
  echo "DEBUG: total_runs=$total_runs"

  if [[ "$total_required" -gt 0 ]]; then
    [[ "$passed" -eq "$total_required" ]] && return 0 || return 1
  fi

  # Empty arrays case — could be no required checks OR required checks that never ran
  if [[ "$total_required" -eq 0 && "$total_runs" -eq 0 ]]; then
    echo "DEBUG: No statuses or check runs visible — probing mergeability via mergeStateStatus..."
    local merge_state
    merge_state=$(gh pr view "$pr_number" --repo "$repo" --json mergeStateStatus --jq '.mergeStateStatus')
    local merge_exit=$?
    echo "DEBUG: gh pr view mergeStateStatus exit code: $merge_exit"
    echo "DEBUG: mergeStateStatus=$merge_state"

    # Possible values: CLEAN, BLOCKED, DIRTY, DRAFT, HAS_HOOKS, UNKNOWN, UNSTABLE
    if [[ "$merge_state" == "BLOCKED" ]]; then
      echo "DEBUG: mergeStateStatus=BLOCKED — treating as required checks exist but none have started (PAT needed)."
      return 2
    elif [[ "$merge_state" == "CLEAN" || "$merge_state" == "HAS_HOOKS" || "$merge_state" == "UNSTABLE" ]]; then
      echo "DEBUG: mergeStateStatus=$merge_state — mergeable without admin rights."
      return 3
    else
      echo "DEBUG: mergeStateStatus=$merge_state — treating conservatively as no required checks configured."
      return 3
    fi
  fi

  return 1
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
    echo "ERROR: Required checks exist but none have started."
    echo "This usually happens when the PR was created with the default GITHUB_TOKEN"
    echo "and the repo has required status checks from other workflows."
    echo "Use a fine-grained PAT with 'Contents: Read & write' and 'Pull requests: Read & write' to create the PR."
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
