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
npm install --save-dev @sinonjs/semantic-auto-release

### 2. Create trigger workflow
Add .github/workflows/org_release.yml:

name: Org Release
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 1 * *'

jobs:
  release:
    uses: sinonjs/semantic-auto-release/bump_and_pr.yml@v1
    secrets: inherit

### 3. Add PR validation and automerge workflow
Add .github/workflows/release_pr_automerge.yml:

name: Validate & automerge bump PR

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  automerge:
    uses: sinonjs/semantic-auto-release/bump_pr_automerge.yml@v1
    permissions:
      contents: write
      pull-requests: write
    secrets: inherit

### 4. Publish after merge
Add .github/workflows/publish_after_merge.yml:

name: Publish after bump PR merge

on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  publish:
    uses: sinonjs/semantic-auto-release/publish_after_merge.yml@v1
    permissions:
      contents: write
      packages: write
      pull-requests: read
    secrets: inherit

## Requirements
- Branch: main is the base for releases
- Secrets: NPM_TOKEN with publish rights
- Branch protection rules: no direct pushes, require status checks before merge
- Optional: enable "Automatically delete head branches" in repo settings for cleanup

## How it works
1. Consumer trigger workflow runs on schedule or manually → calls bump_and_pr.yml
2. bump_and_pr prepares bump commit, opens PR
3. bump_pr_automerge.yml validates and merges PR when green
4. publish_after_merge.yml publishes to npm + GitHub
5. Branch is deleted after success
