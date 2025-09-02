#!/usr/bin/env bash
set -euo pipefail

: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

REPO="${GITHUB_REPOSITORY}"

# --- Determine default branch from repo metadata ---
DEFAULT_BRANCH=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${REPO}" | jq -r .default_branch)

# --- Function to check if PAT is valid ---
check_pat_valid() {
  local token="$1"
  local login
  login=$(curl -s -H "Authorization: Bearer ${token}" https://api.github.com/user | jq -r .login)
  [[ "$login" != "null" && -n "$login" ]]
}

# --- Decide which token to use ---
if [[ -n "${RELEASE_PAT:-}" ]]; then
  if check_pat_valid "$RELEASE_PAT"; then
    echo "PAT provided and is valid. Using PAT for GitHub CLI and API calls."
    export GH_TOKEN="$RELEASE_PAT"
    USING_PAT=true
  else
    echo "WARNING: Provided PAT is invalid. Falling back to the Actions-provided GITHUB_TOKEN."
    export GH_TOKEN="$GITHUB_TOKEN"
    USING_PAT=false
  fi
else
  echo "No PAT provided. Using the Actions-provided GITHUB_TOKEN."
  export GH_TOKEN="$GITHUB_TOKEN"
  USING_PAT=false
fi

# --- Check branch protection for required status checks ---
REQUIRED_CHECKS=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${REPO}/branches/${DEFAULT_BRANCH}/protection" \
  | jq -r '.required_status_checks.contexts | @csv' 2> /dev/null || echo "")

if [[ "$USING_PAT" == false && -n "$REQUIRED_CHECKS" && "$REQUIRED_CHECKS" != "null" ]]; then
  echo "ERROR: Default branch '${DEFAULT_BRANCH}' has required status checks (other workflows): $REQUIRED_CHECKS"
  echo "Pull requests opened by workflows using only the Actions-provided GITHUB_TOKEN will not trigger those workflow runs, which will block the merge."
  echo "To merge the updated changelog and package.json (version bump), this workflow must open a pull request that triggers and passes the required checks."
  echo "Add a Fine-grained GitHub Personal Access Token (PAT) with [ Contents: Read & write, Pull requests: Read & write ] permissions for the repo as a secret named RELEASE_PAT in your repository settings on GitHub."
  exit 1
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

# --- Build PR body with maintainer guidance ---
PR_BODY=$(
  cat << EOF
Automated release PR for version ${VERSION} (changelog + package.json version bump).

This pull request was created by the semantic-auto-release workflow.

If this PR fails to merge automatically:
- Troubleshoot and resolve the issue.
- Once the blocking issue is resolved, you can either:
  - Merge this PR, create, and publish a new version manually **or**
  - Close this PR and delete the branch \`${TEMP_BRANCH}\`, then re-run the workflow to restart the auto-release process.
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

# --- If using a valid PAT and required checks exist, retry merge until it works ---
if [[ "$USING_PAT" == true && -n "$REQUIRED_CHECKS" && "$REQUIRED_CHECKS" != "null" ]]; then
  echo "=== Waiting for required checks by retrying merge for PR #$PR_NUMBER ==="
  max_attempts=40 # ~10 minutes if sleep=15
  attempt=1
  merged=false
  while ((attempt <= max_attempts)); do
    if gh pr merge "$PR_NUMBER" --squash; then
      echo "Merge succeeded on attempt $attempt."
      merged=true
      break
    else
      echo "Merge attempt $attempt failed — likely waiting on required checks. Retrying in 15s..."
      sleep 15
    fi
    ((attempt++))
  done
  if [[ "$merged" != true ]]; then
    echo "ERROR: Could not merge PR #$PR_NUMBER after $max_attempts attempts."
    exit 1
  fi
else
  echo "=== Merging PR ==="
  gh pr merge "$PR_NUMBER" --squash
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
