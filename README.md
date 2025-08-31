# semantic-auto-release

Automated semantic release flow for npm packages using Conventional Commits

Addresses several shortcomings in standard semantic‑release setups, including:

- Inability to work on repos with a protected default branch that requires a PR
- Not updating `package.json` and `package-lock.json` versions
- Not updating changelog files in repos

No GitHub personal access tokens (PATs) or admin‑level permissions are required — just add an npm token in your repo's secrets as `NPM_TOKEN`.

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

7.  (Recommended) Protect your main branch

    If you don't already have branch protection on your default branch and would like to enable it:
    - Settings → Branches → Add branch protection rule
      - Branch name pattern: `main` (or your default branch)
      - Require a pull request before merging
      - Optionally require status checks to pass (choose the checks your repo relies on)
      - Optionally enforce linear history and restrict who can push (if applicable)

    We highly recommend protecting the main branch to ensure only validated changes are merged.

8.  Create the trigger workflow (consumer‑owned prep + release script step)

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
        steps:
          - name: Checkout
            uses: actions/checkout@v5
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

          - name: Run release script
            env:
              GITHUB_TOKEN: ${{ github.token }}
              GH_TOKEN: ${{ github.token }}
              NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
              CHANGELOG_FILE: CHANGELOG.md
              RUN_PRETTIER_ON_CHANGELOG: true
            run: ./node_modules/@yasharf/semantic-auto-release/scripts/run-release.sh
    ```

    Commit these changes and push to main. Your first automated PR will be created on the next manual trigger or scheduled run.

## How it works

1. **Prep and release run in the same job**
   - The consumer's workflow runs all prep steps (checkout, install, build/test/lint) and then calls the release script from this package as the final step.
   - This ensures the same runner instance is used, so the repo, installed dependencies, and any build artifacts are preserved.

2. **Create a short‑lived release branch**
   - The release script generates a unique branch name for the run (e.g. `temp_release_<run_id>_<run_number>`) from the latest `main`.

3. **Calculate release data**
   - `semantic-release` runs in no‑write mode (`--dry-run`) with a custom plugin from this package.
   - The plugin captures `nextRelease.version` and `nextRelease.notes` for subsequent steps.

4. **Generate, format, and commit release files**
   - Scripts in this package:
     - Write the changelog file specified by `CHANGELOG_FILE` with the new release notes.
     - Optionally format the changelog file with Prettier if `RUN_PRETTIER_ON_CHANGELOG` is set to `true`.  
       If Prettier is installed in the repo, its version and config are used; otherwise, the latest Prettier defaults are applied.
     - Update `package.json` and `package-lock.json` with the new version.
   - The changes are committed to the ephemeral branch and a PR is opened to `main`.

5. **Merge and publish**
   - The script merges the PR containing the changelog and version bump into `main`, then tags, publishes to npm, and creates a GitHub Release.
   - Before tagging and publishing, the script checks if there have been any unexpected commits added to `main` since the release calculation.  
     If such commits are detected, the script will abort. In this case, the changelog committed by the PR will not include the new commit(s), and the user will need to perform a manual release (to npm, GitHub package release, and tag) to ensure the changelog and published package are accurate.
   - Overwrites `.npmrc` npm credentials with `NPM_TOKEN` to ensure authentication to the npm registry.  
     **Note:** If you have unusual `.npmrc` customizations, be aware that the script may overwrite conflicting auth lines.

6. **Cleanup**
   - Deletes the ephemeral branch from the remote repository after the PR is merged, in case the repo isn't set to automatically delete PR branches.

## License

Released under [BSD-3](LICENSE).
