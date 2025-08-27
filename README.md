# semantic-auto-release

Automated, secure, PR‑based semantic release flow for npm packages with Conventional Commits enforcement.

## What it does

- Enforces Conventional Commits in all PRs
- Calculates next version via semantic-release
- Updates CHANGELOG.md, package.json, package-lock.json in main
- Opens a bump PR to protected main branch
- Validates commit authors and changed files before merge
- Auto‑merges the PR when all CI checks pass
- Publishes the package to npm and creates a GitHub Release
- Cleans up the temporary bump branch

## How to enable in your repo

### 1. Install

`npm install --save-dev @yasharf/semantic-auto-release`

### 2. Create a single trigger workflow

Add .github/workflows/ci_auto_release.yml:

```
name: CI Auto Release
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 1 * *'
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review, closed]
    branches:
      - main

jobs:
  release:
    uses: sinonjs/semantic-auto-release/semantic_auto_release.yml@v1
    permissions:
      contents: write
      pull-requests: write
      packages: write
    secrets: inherit
```

## Requirements

- Branch: main is the base for releases
- Actions Secrets: NPM_TOKEN with publish rights
- Branch protection rules: no direct pushes, require status checks before merge
- Optional: enable "Automatically delete head branches" in repo settings for cleanup

## How it works

1. Trigger runs on schedule or manual dispatch → bump job in semantic_auto_release.yml opens PR
2. PR events trigger validation and auto‑merge job
3. PR close/merge into main triggers publish job
4. Package is tagged, npm published, GitHub Release created
5. Temporary bump branch is deleted

## License

Released under [BSD-3](LICENSE)
