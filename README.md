# semantic-auto-release

Automated, secure, PR-based semantic release flow for npm packages using Conventional Commits.  
Designed for protected `main` branches with zero manual publishing.

## Quick start

1.  **Install the package**

    npm install --save-dev @yasharf/semantic-auto-release

2.  **Install and initialize Husky**

    npm install --save-dev husky  
    npx husky init

3.  **Enable Conventional Commits enforcement**

    Add this to your `package.json`:

        "commitlint": {
          "extends": ["@yasharf/semantic-auto-release/commitlint"]
        }

4.  **Set up the Husky commit-msg hook (shim)**

    Create `.husky/commit-msg` with the following content:

        #!/bin/sh
        "$(pwd)/node_modules/@yasharf/semantic-auto-release/.husky/commit-msg" "$@"

    Then make it executable:

        chmod +x .husky/commit-msg

    This delegates to the hook logic inside the package. Updates are picked up automatically when you update the package.

5.  **Add NPM_TOKEN**

    In your repository: Settings → Secrets and variables → Actions → New repository secret  
    Name: `NPM_TOKEN` (must have publish rights to your package scope)

6.  **Create the trigger workflow**

    Add `.github/workflows/ci_auto_release.yml`:

```
    name: CI Auto Release
    on:
      workflow_dispatch:
      schedule:
        - cron: "0 0 1 * *"
      pull_request:
        types: [opened, synchronize, reopened, ready_for_review, closed]
        branches:
          - main
      push:
        branches:
          - main
    jobs:
      release:
        uses: YasharF/semantic-auto-release/.github/workflows/semantic_auto_release.yml@v1
        permissions:
          contents: write
          pull-requests: write
          packages: write
        secrets: inherit
```

7.  **Configure repo settings**
    - Protect `main` and require PRs before merging

Commit these changes and push to `main`. Your first automated PR will be created on the next manual trigger or scheduled run.

## How it works

1. **Bump job**: Analyzes commits since the last release, calculates the next version, updates `CHANGES.md` and package files, and opens a PR from a bump branch.
2. **Validation job**: Ensures only expected files changed and the PR was authored by automation. If valid, it enables auto-merge.
3. **Publish job**: Runs on merge to `main`. If the bump commit is present, it publishes to npm, creates a GitHub Release, and deletes the bump branch.

## Updating

- The reusable workflow is referenced via a tag in `uses:`. Pin to a major tag (e.g. `@v1`) for stability and update when needed.
- The Husky hook shim stays the same; updates to hook logic are picked up automatically when you update this package.

## License

Released under [BSD-3](LICENSE).
