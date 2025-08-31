# semantic-auto-release

Automated, secure, PR‑based semantic release flow for npm packages using Conventional Commits.  
Designed for protected main branches with zero manual publishing, using a permanent, bot‑only staging branch for safe versioning and changelog generation.  
No personal access tokens (PATs) or admin‑level permissions are required — just a one‑time branch protection setup in the GitHub UI.

## Quick start

1.  Install the package

    ```bash
    npm install --save-dev @yasharf/semantic-auto-release
    ```

2.  Install and initialize Husky

    ```bash
    npm install --save-dev husky
    npx husky init
    ```

3.  Enable Conventional Commits enforcement

    Add this to your package.json:

    ```json
    "commitlint": {
      "extends": ["@yasharf/semantic-auto-release/commitlint"]
    }
    ```

4.  Set up the Husky commit-msg hook (shim)

    Create `.husky/commit-msg` with the following content:

    ```bash
    #!/bin/sh
    "$(pwd)/node_modules/@yasharf/semantic-auto-release/.husky/commit-msg" "$@"
    ```

    Then make it executable:

    ```bash
    chmod +x .husky/commit-msg
    ```

    This delegates to the hook logic inside the package. Updates are picked up automatically when you update the package.

5.  Add NPM_TOKEN

    In your repository: Settings → Secrets and variables → Actions → New repository secret  
    Name: `NPM_TOKEN` (must have publish rights to your package scope)

6.  Enable PR creation permissions

    In your repository: Settings → Actions → General → Workflow permissions →  
    Check “Allow GitHub Actions to create and approve pull requests”.

7.  Create and protect the staging branch
    - Create a permanent branch named `auto-release-staging` off main. For example:

      ```bash
      git checkout main
      git pull
      git checkout -b auto-release-staging
      git push -u origin auto-release-staging
      ```

    - Protect it: Settings → Branches → Add branch protection rule
      - Branch name pattern: `auto-release-staging`
      - Enable “Restrict who can push to matching branches”
      - Add `github-actions[bot]` to the allowed list
      - Do not require PRs or checks for this branch — it is automation‑only

    This branch will be used for all automated release PRs.

8.  (Recommended) Protect your main branch

    If you don’t already have branch protection on your default branch and would like to enable it:
    - Settings → Branches → Add branch protection rule
      - Branch name pattern: `main` (or your default branch)
      - Require a pull request before merging
      - Optionally require status checks to pass (choose the checks your repo relies on)
      - Optionally enforce linear history and restrict who can push (if applicable)

    We highly recommend protecting the main branch to ensure only validated changes are merged.

9.  Create the trigger workflow (consumer‑owned prep + release script step)

    Add `.github/workflows/ci_auto_release.yml` and add your custom steps such as lint check, tests, builds, etc.:

    ```yaml
    name: CI Auto Release

    on:
      workflow_dispatch:
      schedule:
        - cron: "0 0 1 * *"

    jobs:
      release:
        runs-on: ubuntu-latest
        permissions:
          contents: write
          pull-requests: write
          packages: write
        env:
          HUSKY: 0
          GITHUB_TOKEN: ${{ github.token }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        steps:
          - name: Checkout
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - name: Setup Node
            uses: actions/setup-node@v4
            with:
              node-version: lts/*
              cache: npm

          - name: Install dependencies
            run: npm ci

          # add other steps such as lint, test, type build, etc.

          - name: Run release
            run: ./node_modules/@yasharf/semantic-auto-release/scripts/run-release.sh
    ```

    Commit these changes and push to main. Your first automated PR will be created on the next manual trigger or scheduled run.

## How it works

1. **Prep and release run in the same job**
   - The consumer’s workflow runs all prep steps (checkout, install, build/test/lint) and then calls the release script from this package as the final step.
   - This ensures the same runner instance is used, so the repo, installed dependencies, and any build artifacts are preserved.

2. **Reset staging branch**
   - The release script hard‑resets `auto-release-staging` to the latest `main` to ensure a clean base.

3. **Calculate release data**
   - `semantic-release` runs in no‑write mode (`--dry-run`) with a custom plugin from this package.
   - The plugin captures `nextRelease.version` and `nextRelease.notes` for subsequent steps.

4. **Generate and commit release files**
   - Scripts in this package:
     - Write `CHANGES.md` with the new release notes.
     - Update `package.json` and `package-lock.json` with the new version.
   - The changes are committed to `auto-release-staging` and a PR is opened to `main`.

5. **Merge and publish**
   - The script merges the PR containing the changelog and version bump into `main`, then tags, publishes to npm, and creates a GitHub Release.

## About the auto-release-staging branch

- This branch is permanent and automation‑only.
- It is hard‑reset to main on each release run.
- Do not push commits to this branch — changes will be lost and may disrupt publishing.

## Notes to maintainers

- Running prep and release as separate jobs caused the release job to start on a fresh runner, losing all state from prep (repo checkout, installed packages, build artifacts). This broke builds that relied on prep outputs. The fix is to run prep and release in the same job so state is preserved.
- The prep steps are consumer‑owned, but checkout and install dependencies are required so the release script can run correctly. Beyond that, consumers decide their own build/test/type steps.
- There is no secure way to use an unprotected staging branch for releases — even if you validate PR author, branch name, or commit info. Those checks can be bypassed or invalidated between validation and merge. Restricting who can push to `auto-release-staging` is required for security.
- Do not trigger publish on push to main without guarding for release PR merges — this caused unintended publishes.
- Do not collapse the `GH_TOKEN` / `GITHUB_TOKEN` distinction — `gh` CLI uses `GH_TOKEN`; `@semantic-release/github` uses `GITHUB_TOKEN`.
- `semantic-release` does not push branches — the release script pushes `auto-release-staging` before opening the PR.
- `semantic-release` does not update `CHANGES.md` when run with `--dry-run` — `CHANGES.md` is generated from `nextRelease.notes`.
- `semantic-release` does not update `package.json` by itself — the release script writes the version once it is determined.

## License

Released under [BSD-3](LICENSE).
