#!/usr/bin/env bash
set -euo pipefail

: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

REPO="${GITHUB_REPOSITORY}"

# --- Token selection ---
if [[ -n "${RELEASE_PAT:-}" ]]; then
  echo "PAT provided. Using PAT for GitHub CLI and API calls."
  export GITHUB_TOKEN="$RELEASE_PAT"
  export GH_TOKEN="$RELEASE_PAT"
  USING_PAT=true
else
  echo "No PAT provided. Using the Actions-provided GITHUB_TOKEN."
  export GH_TOKEN="$GITHUB_TOKEN"
  USING_PAT=false
fi

# --- Function: poll all checks until pass/fail/timeout ---
# Returns:
#   0 = all success
#   1 = fail
#   2 = stuck after timeout
#   3 = no checks observed (array, but empty)
#   4 = PAT provided, no branch protection (never saw an array)
poll_checks() {
  local repo="$1" pr_number="$2"
  local head_sha
  head_sha=$(gh pr view "$pr_number" --repo "$repo" --json headRefOid --jq '.headRefOid' 2> /dev/null || echo "")
  echo "Head SHA: $head_sha"

  local attempt=1 max_attempts=10
  local all_not_array=true

  https://api.github.com/repos/

  while ((attempt <= max_attempts)); do
    echo "----------------"
    if [[ -z "$head_sha" ]]; then
      echo "Attempt $attempt/$max_attempts: Could not get head SHA yet."
      if ((attempt == max_attempts)); then
        echo "INFO: No checks were detected within the wait window."
        return 3
      fi
      sleep 30
      ((attempt++))
      head_sha=$(gh pr view "$pr_number" --repo "$repo" --json headRefOid --jq '.headRefOid' 2> /dev/null || echo "")
      continue
    fi

    local checks_json
    checks_json=$(gh api "/repos/$repo/commits/$head_sha/check-runs" --jq '.check_runs' 2> /dev/null || echo "[]")

    echo "pre payload detection:$checks_json"

    # Detect if this payload is not an array
    if ! echo "$checks_json" | jq -e 'type=="array"' > /dev/null 2>&1; then
      checks_json="[]"
    else
      all_not_array=false
    fi

    echo "post payload detection:$checks_json"
    local count
    count=$(echo "$checks_json" | jq 'length')
    echo "Found $count check(s)"
    if [[ "$count" -eq 0 ]]; then
      echo "Attempt $attempt/$max_attempts: No checks found yet."
      if ((attempt == max_attempts)); then
        if $all_not_array; then
          return 4 # PAT provided, no branch protection
        else
          return 3 # no checks observed, but array type was seen
        fi
      fi
      sleep 30
      ((attempt++))
      continue
    fi

    echo "Attempt $attempt/$max_attempts"
    echo "$checks_json" | jq -r '.[] | "  - \(.name): status=\(.status), conclusion=\(.conclusion // "n/a")"'

    local all_success=true
    for row in $(echo "$checks_json" | jq -r '.[] | @base64'); do
      _jq() { echo "$row" | base64 --decode | jq -r "$1"; }
      local status=$(_jq '.status')
      local conclusion=$(_jq '.conclusion')
      local name=$(_jq '.name')

      case "$status" in
        queued | in_progress)
          if ((attempt == max_attempts)); then
            echo "ERROR: Check \"$name\" is still \"$status\" after our timeout. Aborting the release process."
            return 2
          fi
          all_success=false
          ;;
        completed)
          case "$conclusion" in
            success | neutral | cancelled | skipped) ;;
            failure | error | timed_out)
              echo "ERROR: Check \"$name\" failed ($conclusion). Aborting the release process."
              return 1
              ;;
            action_required)
              if ((attempt == max_attempts)); then
                echo "ERROR: Check \"$name\" is still \"$conclusion\" after our timeout. Aborting the release process."
                return 2
              fi
              all_success=false
              ;;
          esac
          ;;
      esac
    done

    $all_success && return 0
    sleep 30
    ((attempt++))
  done
}

# --- Run semantic-release to export version, notes, and branch ---
export release_step=create_release_files
npx semantic-release --no-ci --dry-run --extends ./release.config.js

VERSION=$(cat version.txt)
DEFAULT_BRANCH=$(cat branch.txt)

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

PR_NUMBER=$(gh pr view "$PR_URL" --json number --jq '.number')

echo "Waiting for 30 seconds for GitHub to setup the pull request."
sleep 30 # Give GitHub a moment to register the PR and any associated checks

# --- Merge logic ---
CHECKS_UNOBSERVED=false
if ! $USING_PAT; then
  if ! gh pr merge "$PR_NUMBER" --squash 2> /dev/null; then
    echo "ERROR: Pull request merge failed while using the action provided GITHUB_TOKEN."
    echo "If you have branch protection with required checks, set RELEASE_PAT in the workflow to a Personal Access Token from GitHub with fine-grain permissions: {Contents: Read & write, Pull requests: Read & write}"
    exit 1
  fi
else
  set +e
  poll_checks "$REPO" "$PR_NUMBER"
  rc=$?
  set -e
  case "$rc" in
    0) ;;                        # all good
    1 | 2) exit 1 ;;             # fail or stuck
    3) CHECKS_UNOBSERVED=true ;; # no checks found — proceed but warn
    4) ;;                        # PAT provided, no branch protection, all else good
    *) exit 1 ;;
  esac
fi

echo "=== Merging PR ==="
if ! gh pr merge "$PR_NUMBER" --squash; then
  if $USING_PAT && $CHECKS_UNOBSERVED; then
    echo "ERROR: Merge failed and we could not read PR checks or their status."
    echo "The RELEASE_PAT may be missing permissions: {Contents: Read & write, Pull requests: Read & write}"
  fi
  exit 1
fi

if $USING_PAT && $CHECKS_UNOBSERVED; then
  echo "WARNING: Merge succeeded but we could not read PR checks or their status."
  echo "If your pull requests have checks, verify that RELEASE_PAT has the required permissions: {Contents: Read & write, Pull requests: Read & write}"
fi

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
