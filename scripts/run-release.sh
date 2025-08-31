#!/usr/bin/env bash
set -euo pipefail

# --- Required parameters from env ---
: "${CHANGELOG_FILE:?CHANGELOG_FILE env var is required}"
: "${RUN_PRETTIER_ON_CHANGELOG:?RUN_PRETTIER_ON_CHANGELOG env var is required}"

# --- Generate a unique ephemeral branch name for this run ---
TEMP_BRANCH="temp_release_${GITHUB_RUN_ID}_${GITHUB_RUN_NUMBER}"

echo "=== Creating ephemeral release branch: $TEMP_BRANCH ==="
git fetch origin main || true
git checkout -b "$TEMP_BRANCH" origin/main

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

echo "=== Running semantic-release dry-run with export plugin ==="
export release_step=create_release_files
npx semantic-release --no-ci --dry-run --extends ./release.config.js

VERSION=$(cat version.txt)
if [[ -z "$VERSION" ]]; then
  echo "No release necessary."
  exit 0
fi
NOTES_FILE="notes.md"

echo "=== Updating $CHANGELOG_FILE and package.json ==="
node ./scripts/write-changes-md.js "$VERSION" "$NOTES_FILE" "$CHANGELOG_FILE"

# Optionally run Prettier before staging
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

echo "=== Creating PR into main ==="
gh pr create \
  --base main \
  --head "$TEMP_BRANCH" \
  --title "chore(release): ${VERSION}" \
  --body "Automated release PR for version ${VERSION} (changelog + version bump)."

echo "=== Merging PR ==="
PR_NUMBER=$(gh pr list --head "$TEMP_BRANCH" --base main --state open --json number --jq '.[0].number')
if [[ -n "$PR_NUMBER" ]]; then
  gh pr merge "$PR_NUMBER" --squash
fi

echo "=== Tagging and publishing ==="
git fetch origin main
git checkout main
git tag "v$VERSION"
git push origin "v$VERSION"

# Remove any conflicting auth from project-level .npmrc
if [ -f .npmrc ]; then
  grep -v '//registry.npmjs.org/:_authToken=' .npmrc > .npmrc.tmp && mv .npmrc.tmp .npmrc
fi
# Append our auth to user-level npmrc without leaking token to logs
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
git push origin --delete "$TEMP_BRANCH" || echo "Warning: could not delete branch $TEMP_BRANCH (it may have already been removed)"
