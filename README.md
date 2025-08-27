# semantic-auto-release

Automated, secure, direct-to-main semantic release flow for npm packages with Conventional Commits enforcement.

## What it does

- Enforces Conventional Commits (via included commitlint config and optional local Husky hook)
- Calculates the next version using semantic-release
- Updates CHANGES.md and bumps version in package.json and package-lock.json
- Publishes the package to npm and creates a GitHub Release with changelog notes

## How to enable in your repo

### 1. Install

npm install --save-dev @yasharf/semantic-auto-release

### 2. Add release config

Copy release.config.js from this package into the root of your repo (or reference it directly if preferred).

### 3. Create a trigger workflow

Add .github/workflows/ci_auto_release.yml:

```
name: CI Auto Release
on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 1 * *"

jobs:
  release:
    uses: ./.github/workflows/semantic_auto_release.yml
    permissions:
      contents: write
      packages: write
    secrets: inherit
```

## Requirements

- Branch: main is the base for releases
- Actions Secrets: NPM_TOKEN with publish rights
- Workflow permissions: in repository Settings → Actions → General, enable "Read and write permissions" and allow GitHub Actions to create releases
- Optional: any branch protection can be disabled for fully automated direct pushes

## How it works

1. Triggered manually or on schedule.
2. Workflow checks out main, installs dependencies.
3. semantic-release analyzes commits since last tag, determines new version, updates changelog and package files.
4. Commit, tag, npm publish, GitHub Release creation all happen in one job.

## License

Released under BSD-3 (see LICENSE).
