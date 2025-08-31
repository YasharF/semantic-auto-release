#!/usr/bin/env bash
set -euo pipefail

# --- Required parameters from env ---
: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

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

echo "=== Creating PR into $DEFAULT_BRANCH ==="
gh pr create \
  --base "$DEFAULT_BRANCH" \
  --head "$TEMP_BRANCH" \
  --title "chore(release): ${VERSION}" \
  --body "Automated release PR for version ${VERSION} (changelog + version bump)."

echo "=== Merging PR ==="
PR_NUMBER=$(gh pr list --head "$TEMP_BRANCH" --base "$DEFAULT_BRANCH" --state open --json number --jq '.[0].number')
if [[ -n "$PR_NUMBER" ]]; then
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
