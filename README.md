# semantic-auto-release

Automated semantic-release for repositories that must ship through protected branches, pull requests, and npm Trusted Publishing—without juggling personal access tokens.

## Why teams use it

- **PR-first releases** – every release is proposed as a pull request so protected branches stay locked down.
- **Changelog + version bumps included** – `package.json`, `package-lock.json`, and `CHANGES.md` stay in sync on every run.
- **Tokenless npm publish** – leverages GitHub's OIDC integration with npm provenance; no long-lived secrets to rotate.
- **Reusable quality gate** – a shared checks workflow runs commitlint, formatting, and integration tests before anything merges.

## What's in the box

- `.github/workflows/auto-release.yml` – orchestrates the release flow (evaluate → stage → checks → PR → publish).
- `.github/workflows/checks.yml` – reusable workflow for commitlint + formatting + integration tests.
- `release.config.js` and `plugins/export-release-data.js` – semantic-release configuration that exports the next version, release notes, and base branch for later jobs.
- `scripts/update-packagejson-ver.js` and `scripts/write-changes-md.js` – helper scripts used in staging to bump versions and prepend changelog notes.
- `commitlint.config.js` and `./conventional-commits` helper – easy Husky integration for Conventional Commits enforcement.

> The workflows in this repository double as our own dogfood environment. Feel free to copy and adapt them—just swap in your project's build/test steps where ours run `npm run test:live`.

## Prerequisites

Before enabling the workflow make sure:

- Your project uses (or is ready to adopt) [Conventional Commits](https://www.conventionalcommits.org/).
- Branch protection on your default branch requires pull requests and status checks.
- **Settings → Actions → General → Workflow permissions** has “Allow GitHub Actions to create and approve pull requests” enabled.
- npm provenance is enabled for your package (npm: Package → Settings → Provenance → “Set up with GitHub”).
- The required status checks on the default branch include the contexts emitted by this workflow (`Checks / Build & Commit Checks` and `Checks / PR Title Check` by default).

## Install

Add the package to your devDependencies:

```bash
npm install --save-dev @yasharf/semantic-auto-release
```

## Wire it up

1. **Copy the reference workflows.** Drop `.github/workflows/auto-release.yml` and `.github/workflows/checks.yml` into your project. Adjust the schedule, node version, or test commands as needed. The staging job expects a changelog file named `CHANGES.md`; set `CHANGELOG_FILE` if you prefer a different file.
2. **Hook up commitlint.** Either wire Husky's `commit-msg` hook to the provided `conventional-commits` script or integrate the exported `commitlint` config into your existing tooling so commits fail fast when they don't match the spec.
3. **Confirm branch protection.** Require the two status contexts emitted by `release-status` (or update the job to match your naming). Squash merge must remain enabled because the workflow uses it when auto-merging the release PR.
4. **Run a smoke test.** Trigger “Start Release” manually from the Actions tab. If semantic-release finds no new commits the workflow will exit early; otherwise it will open a release PR with the version bump and changelog changes.

## Release flow at a glance

1. **`evaluate-release`** runs `semantic-release` in dry-run mode and captures the proposed version, release notes, and target branch. If nothing should ship, the workflow stops here.
2. **`stage-release`** checks out a temporary branch, updates versions and `CHANGES.md`, optionally formats the changelog with Prettier, and pushes the branch.
3. **`release-checks`** calls the reusable `checks.yml` workflow against that temporary branch so all required validation runs before any merge occurs.
4. **`release-status`** publishes commit statuses so protected branches recognize the results from step 3.
5. **`create-pr`** opens a release pull request seeded with the release notes and enables auto-merge (falling back to an immediate squash merge when necessary).
6. **`publish`** waits for the PR to land, checks out the merge commit, runs build/tests if configured, publishes to npm with provenance, and creates a GitHub Release tagged `v<version>`.

## Conventional Commits cheat sheet

semantic-auto-release relies on the default analyzers from `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`:

| Commit type                          | Effect                         |
| ------------------------------------ | ------------------------------ |
| `fix:` / `perf:` / other patch types | Patch bump (`1.2.3` → `1.2.4`) |
| `feat:`                              | Minor bump (`1.2.3` → `1.3.0`) |
| Footer `BREAKING CHANGE:`            | Major bump (`1.2.3` → `2.0.0`) |

Tips:

- Use the `BREAKING CHANGE:` footer (with a blank line before it) for majors; the `type!:` shorthand is intentionally ignored to reduce accidents.
- Tag your last manual release (e.g. `v1.0.0`) before adopting the automation so semantic-release has a base reference.
- Consider adding a PR title check (the provided `Checks` workflow already does this) to catch non-conforming PR titles that might be copied into squash commits.

## Customizing the workflow

- **Different changelog file?** Update the `CHANGELOG_FILE` environment variable in `auto-release.yml` or remove the changelog step entirely if you don't keep one.
- **No Prettier?** Comment out or delete the “Optionally run Prettier on changelog” step.
- **Additional validation?** Add steps to `checks.yml` or pass a different workflow reference into `release-checks`.
- **Multi-package repo?** The current scripts assume a single package. For workspaces you can replace the helper scripts with equivalents that update the right manifests before committing.

## Troubleshooting

- **Workflow skipped after evaluate-release:** semantic-release didn't detect new conventional commits since the last tag. Push another conventional commit or confirm your manual tags are up to date.
- **Release PR can't auto-merge:** Ensure squash merge is enabled and that branch protection recognizes the status contexts published in `release-status`.
- **npm publish fails with provenance errors:** Double-check that npm Trusted Publishing is configured for the exact GitHub repo and owner casing, then re-run the workflow.

## License

Released under [BSD-3](LICENSE).
