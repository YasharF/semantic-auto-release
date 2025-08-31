# semantic-auto-release

Automated, secure, PR-based semantic release flow for npm packages using Conventional Commits.  
Designed for protected `main` branches with zero manual publishing, using an ephemeral automation branch for safe versioning and changelog generation.

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

6.  **Enable PR creation permissions**

    In your repository: Settings → Actions → General → Workflow permissions →  
    Check "Allow GitHub Actions to create and approve pull requests".

7.  **Create the trigger workflow**

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
    jobs:
      release:
        uses: YasharF/semantic-auto-release/.github/workflows/semantic_auto_release.yml@v1
        permissions:
          contents: write
          pull-requests: write
          packages: write
          checks: read
        secrets: inherit
    ```

8.  **Configure repo settings**
    - Protect `main` and require PRs before merging

Commit these changes and push to `main`. Your first automated PR will be created on the next manual trigger or scheduled run.

## How it works

1. **Calculate release data**
   - Workflow creates a unique, ephemeral branch named `temp_auto_release_<run_number>_<attempt>` from `main`.
   - Runs semantic-release in no‑write mode (like `--dry-run`) with a custom plugin from this package.
   - The plugin captures the version (`nextRelease.version`) and release notes (`nextRelease.notes`) and writes them to GitHub Actions outputs.

2. **Generate and commit release files**
   - A script in this package uses the captured version and notes to:
     - Write `CHANGES.md` with the new release notes.
     - Update `package.json` and `package-lock.json` with the new version.
   - These files are committed to the temp branch.
   - A PR is opened from the temp branch to `main`.

3. **Merge the release files**
   - PR is validated to ensure only expected files changed and that it was authored by automation.
   - All required checks must pass before merge.
   - Workflow will auto‑merge the PR when all required checks have passed and the PR content is as expected.

4. **Publish the package**
   - On merge to `main`, workflow tags the commit with `v<version>`.
   - Publishes the package to npm.
   - Creates a GitHub Release from that tag with the changelog notes.

## About the temp_auto_release branches

- These branches are automation-only and will be hard reset or deleted without warning.
- Do not push commits to these branches — any changes will be lost and may disrupt the automated publish process.
- If a job fails and a temp branch is orphaned, future runs will detect and delete older `temp_auto_release_*` branches automatically.

## Notes to maintainers

Known pitfalls and behaviors to avoid, based on prior iterations:

- Do not trigger publish on push to `main` without guarding for release PR merges — this caused unintended publishes.
- Do not collapse the `GH_TOKEN` / `GITHUB_TOKEN` distinction — `gh` CLI uses `GH_TOKEN`; `@semantic-release/github` uses `GITHUB_TOKEN`.
- Validate the temp branch and PR content comprehensively (files, author, etc.).
- semantic-release does not push branches — the workflow must push the temp branch before running it so the branch exists on the remote.
- semantic-release does not update `CHANGES.md` when run with `--dry-run` — that’s why we generate it ourselves from `nextRelease.notes`.
- semantic-release does not update `package.json` — update it manually in the workflow after determining the new version.
- Ensure "Allow GitHub Actions to create and approve pull requests" is enabled in repo settings.

## License

Released under [BSD-3](LICENSE).
