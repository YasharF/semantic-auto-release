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

---

## Implementation details (this repository)

This repository “eats its own dogfood” by using the same PR‑based release flow it provides to consumers.  
The workflows here are structured to satisfy the above behaviour **and** work with a protected `main` branch:

- **Single reusable engine** (`.github/workflows/semantic_auto_release.yml`)  
  Handles all three phases — bump, validate, publish — in one place.  
  The phase is determined by the triggering event:
  - `workflow_dispatch` / `schedule` → bump phase
  - `pull_request` events → validation phase
  - `push` to `main` → publish phase

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

These points are critical to keeping the PR‑based, protected‑branch release flow working as intended and avoiding regressions that have already been encountered and solved.

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
