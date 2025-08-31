#!/usr/bin/env bash
set -euo pipefail

echo "=== Resetting staging branch ==="
git fetch origin main || true
git fetch origin auto-release-staging || true
if git show-ref --verify --quiet refs/heads/auto-release-staging; then
  git checkout auto-release-staging
elif git show-ref --verify --quiet refs/remotes/origin/auto-release-staging; then
  git checkout -b auto-release-staging origin/auto-release-staging
else
  git checkout -b auto-release-staging origin/main
fi
git reset --hard origin/main

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

echo "=== Updating CHANGES.md and package.json ==="
node ./scripts/write-changes-md.js "$VERSION" "$NOTES_FILE"
node ./scripts/update-version.js "$VERSION"

git add CHANGES.md package.json package-lock.json 2> /dev/null || git add CHANGES.md package.json
git commit -m "chore(release): ${VERSION}" || true

echo "=== Pushing to staging branch ==="
git push origin auto-release-staging --force

echo "=== Creating PR into main ==="
gh pr create \
  --base main \
  --head auto-release-staging \
  --title "chore(release): ${VERSION}" \
  --body "Automated release PR for version ${VERSION} (changelog + version bump)."

echo "=== Merging PR ==="
PR_NUMBER=$(gh pr list --head auto-release-staging --base main --state open --json number --jq '.[0].number')
if [[ -n "$PR_NUMBER" ]]; then
  gh pr merge "$PR_NUMBER" --squash
fi

echo "=== Tagging and publishing ==="
git fetch origin main
git checkout main
git tag "v$VERSION"
git push origin "v$VERSION"
npm publish --access public

echo "=== Creating GitHub Release ==="
gh release create "v${VERSION}" \
  --title "v${VERSION}" \
  --notes-file notes.md
