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

6.  **Enable PR creation permissions**

    In your repository: Settings → Actions → General → Workflow permissions →  
    Check **"Allow GitHub Actions to create and approve pull requests"**.

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

8. **Configure repo settings**
   - Protect `main` and require PRs before merging

Commit these changes and push to `main`. Your first automated PR will be created on the next manual trigger or scheduled run.

## How it works

1. **Bump job**: Analyzes commits since the last release, calculates the next version, updates `CHANGES.md`, and commits it to the release branch.
2. **Validation job**: Ensures only expected files changed and the PR was authored by automation. If valid, it enables auto-merge.
3. **Publish job**: Runs when a bump PR is merged into `main`. If the PR meets the criteria (automation author, correct branch naming), it publishes to npm, creates a GitHub Release, and deletes the bump branch.

---

## Implementation details (this repository)

This repository “eats its own dogfood” by using the same PR‑based release flow it provides to consumers.  
The workflows here are structured to satisfy the above behaviour **and** work with a protected `main` branch:

- **Single reusable engine** (`.github/workflows/semantic_auto_release.yml`)  
  Handles all three phases — bump, validate, publish — in one place.  
  The phase is determined by the triggering event:
  - `workflow_dispatch` / `schedule` → bump phase
  - `pull_request` events → validation phase
  - `pull_request` closed (merged) → publish phase

- **Trigger workflow** (`.github/workflows/ci_auto_release.yml`)  
  Matches the consumer quick‑start. Calls the local engine instead of a remote `@v1` tag so changes can be tested here before release.

- **Bump phase specifics**
  - Creates a `release/bump-*` branch from the release branch (`auto_release`).
  - Pushes the branch before running semantic‑release so it exists on the remote.
  - Runs semantic‑release in “prepare only” mode: updates changelog, commits it, but does not publish or tag.
  - Pushes the bump branch and opens a PR back into `main` using the GitHub CLI.

- **Validation phase specifics**
  - Checks that only `CHANGES.md` changed.
  - Verifies the PR author is `github-actions[bot]`.
  - If valid, enables squash auto‑merge.

- **Publish phase specifics**
  - Runs only after a bump PR is merged into `main`.
  - Tags the commit in `main` with the version from `CHANGES.md`.
  - Publishes to npm.
  - Creates a GitHub Release from that tag.

---

## Planned change: switch to `auto_release` branch

To simplify and avoid semantic‑release pushing to protected `main`, we will:

1. Configure semantic‑release to run on `auto_release` instead of `main`.
2. In bump mode, semantic‑release will:
   - Analyze commits since last tag on `auto_release`.
   - Update `CHANGES.md` with the new version and notes.
   - Commit the changelog to `auto_release` without publishing to npm or GitHub, and without tagging.
3. A workflow will:
   - Parse `CHANGES.md` to determine the new version.
   - Update `package.json` and `package-lock.json` manually (semantic‑release does not do this).
   - Create a PR from `auto_release` to `main`.
   - Merge after all PR checks pass.
4. After merge to `main`:
   - Tag the commit with `v<version>`.
   - Publish to npm.
   - Create a GitHub Release from that tag (with changelog notes).

---

## Notes to future maintainers and AI assistants

The current design is the result of multiple iterations and fixes to address issues that arose in earlier attempts.  
If you are reviewing or modifying these workflows, **do not**:

- Trigger publish on `push` to `main` without guarding for bump PR merges — this caused unintended publishes.
- Rely solely on commit message matching to decide publish — brittle and replaced with PR metadata checks.
- Skip pushing the bump branch before semantic‑release — causes branch‑existence validation failures.
- Run bump mode with `branches` set to `main` — semantic‑release will try to push to `main` and fail with branch protection.
- Use `dryRun` in bump mode — it will skip `prepare` and produce no commit.
- Expect semantic‑release to update `package.json` — it does not; update it manually in the workflow.
- Forget to enable "Allow GitHub Actions to create and approve pull requests" in repo settings.

**Why this design?**

- Keeps `main` protected — no direct pushes from automation.
- Ensures every release bump is reviewable and traceable via a PR.
- Allows manual or scheduled control over when bumps and publishes happen.
- Uses the same workflow structure consumers get, so changes are tested here first.
- Splitting behaviour by event type avoids maintaining separate bump/publish workflows and keeps logic in one place.
- Handles GitHub token permission edge cases gracefully.
- Documents known pitfalls so they are not re‑introduced.

---

## Updating

- The reusable workflow is referenced via a tag in `uses:` for consumers.  
  In this repo, we call it locally to test changes before tagging.
- The Husky hook shim stays the same; updates to hook logic are picked up automatically when you update this package.

## License

Released under [BSD-3](LICENSE).
