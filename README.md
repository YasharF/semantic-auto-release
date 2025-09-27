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

## Conventional Commits & Versioning Behavior

This package uses the **default rules** from `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator` with **no custom presets or additional plugins** (beyond those two). That means:

- `fix:` (or other patch‑level types like `perf:`) → patch bump (x.y.z → x.y.(z+1))
- `feat:` → minor bump (x.y.z → x.(y+1).0)
- A **major bump only occurs when a `BREAKING CHANGE:` (or `BREAKING CHANGES:`) footer is present** in the commit body.
- The bang syntax (`feat!:` / `refactor!:`) is **not** currently relied upon for a major release (we intentionally validate only the footer form). If you previously used `feat!:`, add the footer instead.

### Releasing a Major Version

Include a blank line after the subject, then a footer section containing a line that starts with `BREAKING CHANGE:` (or plural). Example:

```
feat: migrate authentication layer to new token model

BREAKING CHANGE: The login() function now returns a Promise<UserSession> instead of User.
```

Multiple breaking notes can be added as separate paragraphs each beginning with `BREAKING CHANGE:`.

### Examples

Patch:

```
fix: correct null handling in resolveConfig
```

Minor:

```
feat: add project capability detection API
```

Major:

```
feat: drop support for Node 18

BREAKING CHANGE: Node 20+ is required.
```

### Common Gotchas

- Footer must be separated from the subject/body by a blank line.
- `BREAKING-CHANGE:` (with a dash) will NOT work; it must be `BREAKING CHANGE:` (space).
- If no previous tag exists, semantic-release treats the first release using the defaults (often `1.0.0`). Ensure you tag any manually published version (`v1.0.0`, etc.) before relying on automation.

### Why Footer Only?

Using only the explicit footer avoids accidental major bumps caused by developers adding `!` to a type for emphasis (outside conventional meaning) and keeps the audit trail of rationale in a structured place.

If community feedback later prefers `type!:` support, it can be re-enabled by adjusting the commit-analyzer configuration—documented changes would then update this section.

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

## Documentation

Core docs have moved into `docs/`:

- Product Requirements: `docs/PRODUCT_REQUIREMENTS.md`
- Architecture: `docs/ARCHITECTURE.md`
- AI Collaboration Guide: `docs/AI_COLLABORATION.md`
- Data Fixtures Reference: `docs/DATA_FIXTURES.md`

### Capability Assessment (Fixtures & Live Mode)

The release flow evaluates repository automation readiness (branch protection style, required status checks, approvals, usable tokens, etc.). There are two ways to run capability assessment:

1. Fixture Mode (deterministic, used in unit tests)
   - Point `assessCapabilities({ fixtureDir })` at a directory containing `step1..step6` JSON files (see `test/fixtures/scenarios/*`).
   - Used for fast, offline test coverage.

2. Live Mode (direct GitHub API probing)
   - Call `assessCapabilities()` without `fixtureDir` and provide:
     - `repo` option OR env `SAR_REPO` (format: `owner/repo`).
     - One or more tokens exposed as env vars whose names match `GH_TOKEN` or `PAT_*` (e.g. `PAT_ADMIN`).
   - Automatically fetches (read‑only) endpoints:
     - Repo metadata
     - Classic branch protection (`/branches/<branch>/protection`)
     - Rulesets for branch (`/rules/branches/<branch>`)
     - Branch metadata / list
     - Collaborator permission for the owner (used to infer push/admin)
   - Returns: `{ context, gaps, tokenMatrix }` where `context.branchProtection` ∈ `none | classic | rules | classic+rules | unknown`.
   - Enforcement flags included in `context`:

     ```
     prRequired: boolean              # Require a pull request before merging
     requiredStatusChecksEnabled: boolean
     requiredStatusCheckContexts: string[]
     ```

# (deferred: code scanning results, signed commits enforcement not collected)

     requiredApprovals?: number       # Pull request approval count if available
     ```

Notes:

- Code scanning and signed commit enforcement flags are out of scope for v1.
- Additional enforcement bits (linear history requirement, required conversation resolution, force‑push / branch deletion restrictions) are not yet collected.

Environment variables:

```
SAR_REPO=owner/repo            # repository to probe (fallback GITHUB_REPOSITORY)
GH_TOKEN / PAT_*               # one or more tokens; all matching names are probed
CAPABILITIES_LIVE=1            # (optional) enables live integration test
```

Run the live integration test (skips automatically if no token):

```bash
CAPABILITIES_LIVE=1 SAR_REPO=owner/repo GH_TOKEN=ghp_xxx npm run test:live
```

Capture fresh fixtures for a scenario (writes `capture_<timestamp>` directory):

```bash
SAR_REPO=owner/repo PAT_ADMIN=ghp_xxx npm run capture:fixture
```

Optional filters:

```bash
TOKENS="PAT_ADMIN,PAT_MIN" OUTPUT=my_scenario npm run capture:fixture
```

You can then rename the output folder to `test/fixtures/scenarios/<scenario_name>/` and add a unit test asserting expected detection.

Live mode is best‑effort and only performs safe GET requests. If all protection endpoints return 403/404 the tool reports `branchProtection` as `none` (private free) or `unknown` when it cannot disambiguate.

#### Push vs PR Release Strategy

For v1, releases ALWAYS proceed through a PR if branch protection requires pull requests (`prRequired` flag true). If no such requirement is detected, future versions may optimize by pushing directly to the default branch (skipping the PR). The current implementation always uses the PR path; direct‑push optimization is deferred. Open an issue if you need earlier support for direct push mode.

#### Required Repository Merge Settings

This tool assumes "Allow squash merging" is enabled on the repository (Settings → General → Pull Requests → Merge button options). A gap will be reported if it is disabled. Other merge strategies (merge commits, rebase) are not required for the release flow and are ignored.

### Repository Administration Automation (Advanced)

For test fixture generation you may need to toggle repository visibility, switch between _classic_ branch protection and _rulesets_, or enable auto‑merge. An optional helper script `scripts/repo-admin.js` is provided to automate these **destructive / mutating** operations. Use only on disposable test repositories or with full awareness of the changes.

Environment prerequisites:

```
SAR_REPO=owner/repo              # target repository
PAT_ADMIN=ghp_xxx                # admin-level PAT (preferred) OR ADMIN_TOKEN
```

Supported ACTIONs:

```
ACTION=set-visibility   VISIBILITY=public|private
ACTION=apply-classic    CHECKS="build,test" APPROVALS=2
ACTION=remove-classic
ACTION=apply-ruleset    CHECKS="build,test" APPROVALS=2
ACTION=delete-rulesets
ACTION=enable-auto-merge ENABLE=true|false
ACTION=capture-scenario  SCENARIO=classic|rules|automerge|classic_rules|rules_codescan_signed|classic_signed|classic_rules_codescan_signed  [CHECKS=..] [APPROVALS=N] [OUTPUT=dir]
```

Examples:

```bash
# Apply classic protection with 2 required approvals + two status checks
SAR_REPO=owner/repo PAT_ADMIN=ghp_x ACTION=apply-classic CHECKS=build,test APPROVALS=2 npm run repo:admin

# Switch to ruleset-based protection
SAR_REPO=owner/repo PAT_ADMIN=ghp_x ACTION=apply-ruleset CHECKS=build,test APPROVALS=2 npm run repo:admin

# Enable auto merge flag
SAR_REPO=owner/repo PAT_ADMIN=ghp_x ACTION=enable-auto-merge ENABLE=true npm run repo:admin

# One-shot scenario capture (classic protection) writing fixtures into classic_real/
SAR_REPO=owner/repo PAT_ADMIN=ghp_x ACTION=capture-scenario SCENARIO=classic CHECKS=build,test APPROVALS=2 OUTPUT=classic_real npm run repo:admin
```

Convenience npm scripts:

```
npm run scenario:classic        # classic protection capture (build,test checks / 2 approvals)
npm run scenario:rules          # ruleset protection capture (build,test checks / 2 approvals)
npm run scenario:automerge      # enable auto-merge and capture
# (manual) classic + rules combo capture example:
# ACTION=capture-scenario SCENARIO=classic_rules CHECKS=build,test APPROVALS=2 npm run repo:admin
# (manual) rules with code scanning + signed commits:
# ACTION=capture-scenario SCENARIO=rules_codescan_signed CHECKS=build,test APPROVALS=2 npm run repo:admin
# (manual) classic with signed commits:
# ACTION=capture-scenario SCENARIO=classic_signed CHECKS=build,test APPROVALS=2 npm run repo:admin
# (manual) classic + rules with code scanning + signed commits:
# ACTION=capture-scenario SCENARIO=classic_rules_codescan_signed CHECKS=build,test APPROVALS=2 npm run repo:admin
```

Resulting capture directories can be renamed under `test/fixtures/scenarios/` to replace synthetic fixtures with authentic API responses.

#### Remote (CI) Scenario Capture

If you prefer to generate real fixtures via GitHub Actions (using the ephemeral `GITHUB_TOKEN` plus an admin PAT), trigger the manual workflow:

Workflow: `.github/workflows/capture-capabilities.yml`

Dispatch inputs:

- `scenario`: classic | rules | automerge
- `checks`: comma list of status contexts
- `approvals`: integer pull request approval requirement
- `visibility`: (classic only) public | private
- `commit-fixtures`: true|false (create PR with captured directory under `test/fixtures/scenarios/<scenario>_real`)

The workflow mutates the repo according to the scenario, captures `step1..step6` responses, optionally commits them, and always uploads the raw capture as an artifact.

## License

Released under [BSD-3](LICENSE).

## Limitations & Deferred Features (v1)

The following capability / diagnostic features are intentionally deferred to a later version:

- Code scanning rule enforcement detection (placeholder flag only)
- Signed commits enforcement (placeholder flag only; partial classic detection may appear but not guaranteed)
- Linear history enforcement detection
- Conversation (required discussions) resolution requirement detection
- Force‑push / branch deletion restriction flags
- Minimum PAT scope recommendation engine (will arrive in v2; currently only generic guidance shown when no usable token is found)
- Rate limit / API error summarization (low call volume today; Octokit headers will be leveraged when/if needed)

### Token Capability Mapping (Early / Experimental)

During capability assessment each detected token environment variable (names matching `GH_TOKEN`, `PAT_*`) is classified. We derive a minimal token recommendation per capability using heuristics (preferring non‑admin tokens that still satisfy requirements):

Capabilities (current set):

- `repo-read` – read repository metadata
- `branch-list` – list branches (used to confirm default branch access)
- `push` – push commits / create branches
- `branch-protection-read` – read classic protection (optional; improves diagnostics)
- `release-basic` – combined requirement for automated release (repo-read + branch-list + push + allowSquashMerge enabled)

Output includes `capabilityMinimumTokens` mapping each capability to the smallest token(s) (by privilege: non-admin before admin) that satisfy it. This is heuristic only; it does not yet perform mutation or PR creation dry-runs. PR creation permission gaps (workflow permission checkbox, repo settings) still require observing actual workflow run context and will be added later.

If any of these are important to your workflow now, please open a GitHub issue describing your scenario and priority.
