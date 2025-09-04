# semantic-auto-release

Automated semantic release flow for npm packages using Conventional Commits

Addresses several shortcomings in standard semantic‑release setups, including:

- Inability to work on repos with a protected default branch that requires a PR
- Not updating `package.json` and `package-lock.json` versions
- Not updating changelog files in repos

No GitHub personal access tokens (PATs) or admin‑level permissions are required — just add an npm token in your repo's secrets as `NPM_TOKEN`.

## Quick start

1. Install the package:

   ```bash
   npm install --save-dev @yasharf/semantic-auto-release
   ```

2. Run the automated setup script:

   ```bash
   npx auto-release-setup --create-workflow
   ```

3. Add `NPM_TOKEN` to your repository secrets (must have publish rights).

4. Enable PR creation permissions in GitHub Actions settings.

5. (Recommended) Add branch protection for your default branch in GitHub and require pull requests.

6. Commit and push the changes made by the setup script, including the changes in `.husky/` and `.github/`.

That's it. The setup is done.

After this point, all git commits need to conform to Conventional Commits. If you have not been using conventional commits, you need to do one more manual package release. Make sure that you version tag (i.e. v1.2.3) gets added to your GitHub repo. The auto-release will need all commits since the last tag to be using Convential Commits to figure out if a publish a new version of your package, and the version number for it. We also highly adding a pull request title checker such as [amannn/action-semantic-pull-request]

---

## Using the setup script

The setup script will:

- Ensure Husky is installed and initialized
- Create or verify the `.husky/commit-msg` hook
- Add or verify the `commitlint` config in `package.json`
- Optionally create a GitHub Actions workflow with a random monthly schedule to avoid traffic spikes
- Tell you exactly when your scheduled run will occur

Flags:

- `-y` → skip confirmation prompt
- `--create-workflow` → create a workflow file
- `--workflow-name=<name>` → optional, overrides default `semantic-auto-release.yml`

If a workflow is created, the script will print the exact UTC day/time it will run each month.

---

## Manual setup

If you prefer not to use the setup script or it fails for some reason, you can configure everything manually:

1. **Install and initialize Husky**:

   ```bash
   npm install --save-dev husky
   npx husky init
   ```

2. **Enable Conventional Commits enforcement**:

   Add this to your `package.json`:

   ```json
   "commitlint": {
     "extends": ["@yasharf/semantic-auto-release/commitlint"]
   }
   ```

3. **Set up the Husky commit-msg hook**:

   Create `.husky/commit-msg` with the following content:

   ```bash
   #!/bin/sh
   npx @yasharf/semantic-auto-release/conventional-commits "$@"
   ```

   Then make it executable:

   ```bash
   chmod +x .husky/commit-msg
   ```

4. **Add `NPM_TOKEN`**:

   In your repository: Settings → Secrets and variables → Actions → New repository secret  
   Name: `NPM_TOKEN` (must have publish rights to your package scope)

5. **Enable PR creation permissions**:

   In your repository: Settings → Actions → General → Workflow permissions →  
   Check “Allow GitHub Actions to create and approve pull requests”.

6. **(Recommended) Protect your default branch**:

   If you don't already have branch protection on your default branch and would like to enable it:
   - Settings → Branches → Add branch protection rule
     - Branch name pattern: your default branch name (e.g., `main` or `master`)
     - Require a pull request before merging
     - Optionally require status checks to pass
     - Optionally enforce linear history and restrict who can push

7. **Create the trigger workflow**:

   Add `.github/workflows/semantic-auto-release.yml` (or your preferred name) and add your custom steps such as lint check, tests, builds, etc.:

   ```yaml
   name: Semantic Auto Release

   on:
     workflow_dispatch:
     schedule:
       - cron: "0 0 1 * *" # adjust as desired

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
           run: npx @yasharf/semantic-auto-release/run-release
   ```

---

## How it works

**Note:** We rely entirely on semantic‑release's own branch resolution logic to determine the repo's default branch. This means it will work whether the branch is set as `main`, `master`, or something else. For simplicity, the rest of this document will refer to this branch as `main`.

1. **Prep and release run in the same job**
   - The consumer's workflow runs all prep steps (checkout, install, build/test/lint) and then calls the release script from this package as the final step.
   - This ensures the same runner instance is used, so the repo, installed dependencies, and any build artifacts are preserved.

2. **Calculate release data**
   - `semantic-release` runs in no‑write mode (`--dry-run`) with a custom plugin from this package.
   - The plugin captures `nextRelease.version`, `nextRelease.notes`, and the repo's default branch name as resolved by semantic‑release.

3. **Create and prepare the release branch**
   - Create a unique short‑lived branch (e.g. `temp_release_<run_id>_<run_number>`) from the latest commit on `main`.
   - Generate the changelog file specified by `CHANGELOG_FILE` with the new release notes.
   - Optionally format the changelog file with Prettier if `RUN_PRETTIER_ON_CHANGELOG` is set to `true`.  
     If Prettier is installed in the repo, its version and config are used; otherwise, the latest Prettier defaults are applied.
   - Update `package.json` and `package-lock.json` with the new version.
   - Commit these changes to the ephemeral branch and open a PR into `main`.

4. **Merge and publish**
   - The script merges the PR containing the changelog and version bump into `main`, then tags, publishes to npm, and creates a GitHub Release.
   - Before tagging and publishing, the script checks if there have been any unexpected commits added to `main` since the release calculation.  
     If such commits are detected, the script will abort. In this case, the changelog committed by the PR will not include the new commit(s), and the user will need to perform a manual release (to npm, GitHub package release, and tag) to ensure the changelog and published package are accurate.
   - Overwrites `.npmrc` npm credentials with `NPM_TOKEN` to ensure authentication to the npm registry.  
     **Note:** If you have unusual `.npmrc` customizations, be aware that the script may overwrite conflicting auth lines.

5. **Cleanup**
   - Deletes the ephemeral branch from the remote repository after the PR is merged, in case the repo isn't set to automatically delete PR branches.

## License

Released under [BSD-3](LICENSE).

---
