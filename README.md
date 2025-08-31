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
    Without this, the bump job will fail when trying to open a PR.

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
        secrets: inherit
```

8.  **Configure repo settings**
    - Protect `main` and require PRs before merging

Commit these changes and push to `main`. Your first automated PR will be created on the next manual trigger or scheduled run.

## How it works

1. **Bump job**: Analyzes commits since the last release, calculates the next version, updates `CHANGES.md` and package files, and opens a PR from a bump branch.
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
  - `pull_request` events (opened/sync/etc.) → validation phase
  - `pull_request` closed (merged) → publish phase

- **Trigger workflow** (`.github/workflows/ci_auto_release.yml`)  
  Matches the consumer quick‑start. Calls the local engine instead of a remote `@v1` tag so changes can be tested here before release.

- **Bump phase specifics**
  - Creates a `release/bump-*` branch from `main`.
  - Pushes the branch before running semantic‑release so it exists on the remote.
  - Runs semantic‑release in “prepare only” mode: updates changelog and package files, commits them, but does not publish.
  - Opens a PR back into `main` using the GitHub CLI.

- **Validation phase specifics**
  - Checks that only `CHANGES.md`, `package.json`, and `package-lock.json` changed.
  - Verifies the PR author is `github-actions[bot]`.
  - If valid, enables squash auto‑merge.

- **Publish phase specifics**
  - Runs only after a bump PR is merged into `main`.
  - Runs semantic‑release with full publish plugins (`@semantic-release/npm`, `@semantic-release/github`).
  - Deletes the merged bump branch from the remote.

### GitHub token permissions and how we handle them

GitHub’s default `GITHUB_TOKEN` can create branches and commits in most contexts, but in some trigger contexts (notably `workflow_dispatch` or `schedule` in the same repository) it may be restricted from creating pull requests via the GraphQL API.  
To ensure PR creation works reliably in all contexts, the implementation uses:

- `GITHUB_TOKEN` for semantic‑release itself (so it can interact with the repo and GitHub Releases).
- `GH_TOKEN` for the GitHub CLI (`gh pr create`).  
  If a `GH_TOKEN` secret is provided (for example, a fine‑scoped Personal Access Token with `repo` permissions), it will be used.  
  If not, the workflows fall back to using `GITHUB_TOKEN` for `gh` as well, which works in most cases.

This dual‑token approach ensures:

- semantic‑release always has the token name it expects.
- `gh` CLI can use a PAT when needed to bypass PR creation restrictions in stricter contexts.

---

## Notes to future maintainers and AI assistants

The current design is the result of multiple iterations and fixes to address issues that arose in earlier attempts.  
If you are reviewing or modifying these workflows, **do not**:

- Split bump and publish into separate workflows unless you also replicate the validation and auto‑merge logic — this was consolidated intentionally to reduce drift and complexity.
- Remove the branch push before running semantic‑release in bump mode — semantic‑release validates that the branch exists on the remote.
- Remove the `--branches` or branch override in bump mode — without it, semantic‑release will think it is running on `main` and skip.
- Collapse the GH_TOKEN/GITHUB_TOKEN distinction — this is required to handle GitHub’s token permission edge cases.
- Re‑enable full publish plugins in bump mode — this will attempt to publish from the bump branch and fail or bypass the PR‑based flow.
- Change the event triggers without understanding their impact on token permissions and phase detection.
- Trigger publish on `push` to `main` without guarding for bump PR merges — this caused unintended immediate publishes when merging unrelated PRs.
- Rely solely on commit message matching to decide publish — brittle and replaced with PR metadata checks.
- Skip pushing the bump branch before semantic‑release — causes branch‑existence validation failures.
- **Run bump mode with `branches` set to the bump branch in config** — semantic‑release will see the event context as `main` and skip, leaving no commits for the PR.  
  Instead, keep `branches: ['main']` in config for bump mode so it calculates the version, but commit to the bump branch.

---

## Known pitfalls

- **GitHub Actions context branch**: Even if you `git checkout` a new branch in the job, `GITHUB_REF` remains the branch that triggered the workflow. semantic‑release uses this to decide if it should run.  
  Solution: In bump mode, leave `branches` in config pointing to your real release branch (e.g. `main`) and just commit the prepared files to the bump branch.
- **Workflow permissions**: Without "Allow GitHub Actions to create and approve pull requests" enabled, `gh pr create` will fail with a GraphQL permission error.

## License

Released under [BSD-3](LICENSE).
