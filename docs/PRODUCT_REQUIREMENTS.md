# Product Requirements: semantic-auto-release

## 1. Vision

Provide a one‑stop, least‑privilege semantic‑release system and setup for JS/TS projects (including protected branches).

## 2. Core Outcomes

- Reliable: Deterministic release calculation separated from publishing side-effects.
- Safe: Prevents publishing if new commits land after version calc. Prevents addition of commits that do not meet Conventional Commits specs.
- Compatible: Works with classic, rules-based, and combined classic + rules branch protections.
- Minimal Permissions: Actively minimizes and documents required scopes; escalates only when necessary.
- Guided: Interactive setup + runtime diagnostics explain what is missing and how to fix it.
- Least-Privilege Enforcement: Detect insufficiency of the default token or provided PAT and recommend minimal PAT scopes or repo setting changes.
- Remediation: Permission gaps produce actionable, categorized errors (what, why, how to fix).
- Consistent Developer Experience: Local (PAT) and CI (GH_TOKEN) flows share the same execution path and diagnostics.
- Simplicity: The implementation and core/package organization needs to be simple so other developers can quickly review it's internals and trust using the package with their PAT.

## 3. User Stories

1. As a maintainer, I want a one-command setup that scaffolds the workflow, hooks, and configs so I can adopt the system quickly.
2. As a maintainer, I want each release to also update the version in package.json and the changelog file in the repo so that history stays reviewable.
3. As a maintainer, I want to avoid accidental version and repo drift due to unexpected commits during the release workflow.
4. As a maintainer, I want releases to work even when branch protection requires PR reviews or status checks, when a PAT has been provided.
5. As a maintainer, I want the tooling to **tell me** (not make me guess) when my current tokens are insufficient and why.
6. As a security-conscious maintainer, I want recommendations for the **minimal** PAT scopes needed, not a blanket request for admin.
7. As a maintainer, I want semantic-release and related controls systems to be updated with a single package update without me having to figure out related library changes and have to manually make changes whenever underlying semantic release libraries or workflows require an update.

## 4. Functional Requirements

- Detect default branch using semantic-release internal resolution.
- Run semantic-release in dry-run to compute: next version, release notes, default branch.
- Write artifacts: `version.txt`, `notes.md`, `branch.txt` (or consolidated JSON later).
- Update version in `package.json` & `package-lock.json` atomically.
- Generate/append to changelog file (`CHANGELOG.md` or configurable) with new section only.
- Optionally Prettier-format changelog if repo or flag indicates.
- Commit package json and changelog to the default (aka main, master) branch and if direct commit to default (aka main, master) branch is not feasable and a PR can create the release:
  - Create ephemeral release branch: `temp_release_<runid>_<runnumber>`.
  - Open PR from ephemeral branch to default branch; idempotent if retried.
  - Merge PR & publish only if no new commits on default branch since calc base commit.
- Publish to npm and create GitHub Release + tag.
- Delete ephemeral branch (remote) post-merge if such a branch was created.
- Identifiable: Auto‑created PRs should indicate they were created by the automation tool.
- Documenter: If proper permissions are provided, comment on PRs whose merged commits are included in the release, indicating the release version.
- Support Windows and Linux/Mac(Bash) executions both in dev and CI environments.

### 4.1 Setup & Capability Detection

- Inspect repository settings & branch protection (classic + rules-based and combined) to determine required operations (push branch, create PR, auto-merge, merge method availability, tag creation) and enforcement flags (PR required, status checks, code scanning, signed commits).
- Enumerate capabilities needed vs currently possessed by available tokens (`GH_TOKEN`, provided PATs).
- Prompt (interactive CLI) during setup for PAT only if a gap exists; list minimal scopes (e.g., `repo`, `workflow` if necessary) with justification.
- Provide remediation suggestions or recommandations when lacking permissions (e.g., “Enable Actions permission: pull-requests: write” or “Add a PAT with repo:status to satisfy required status check re-run”).
- Provide a human-readable diagnostic messages.
- Capability Detection can be used during the initial execution of the setup script for setting up our release and control process. Capability Detection can also be run during each release process.
- Be able to complete capability detection with GH_TOKEN and with both GH_TOKEN+PAT if a PAT is provided. Note: A provided PAT may be invalid, or may or may not have required permissions.

### 4.2 Release Process Permission Guardrails

- Pre-flight phase: without creating anything in GitHub, identify the repo setup and settings that can impact the process given the available tokens.
- Fail fast before performing partial work if we would not be able to complete the release given the provided token(s) (GH_TOKEN, PAT) and the configuration and settings of the repo.
- Classify missing capability root cause: token scope, repo setting (e.g., missing “Allow GitHub Actions to create and approve pull requests”), protection restriction, or environmental (e.g., missing CI secret `NPM_TOKEN`, etc).
- Provide actionable guidance when there is a permission failure.

## 5. Non-Functional Requirements

- Idempotent steps: rerunning after transient failure should not corrupt repo state.
- Observable: Github action/workflow logging and summary outputs for each major phase.
- Maintainability: setup for optional log level parameters to provide more verbose logging for troubleshooting by developers.
- Testability: Unit tests use fixture repos + mocked GitHub API to enable testing of the functionality when fixing bugs or evaluating external changes (dependency changes, API response changes). Unit tests should be created based on the requirements with proper mocked GitHub API data prior to development of functions, code, etc.
- Modularity: no large bash scripts; Node modules with clear contracts.
- Extensibility: Initial version designed for npm, future support for mono-repos or multiple packages, yarn, pnpm.
- Self-cleaner: it should identify failure artifacts such as orphaned PRs or branches that might have been left in the repo from a failed prior run and close or delete them.

## 6. Constraints & Assumptions

- Single-package repository (initial scope).
- Node LTS environment (>=20) in GitHub Actions.
- Semantic release versioning and change log analysis leverages the semantic-release v24.2.8+ npm package.
- Conventional commit enforcement utilizes the @commitlint/cli 19.8.1+ npm package.
- External (Github) Requirements: (Note that A GH_TOKEN is always available.)
  - A GH_TOKEN can be used if the default (aka main, master) branch does have branch protection that requires pull requests with required checks.
  - A GH_TOKEN can be used if the default (aka main, master) branch does have branch protection that requires pull requests but does not require checks to pass, but should warn because it is unable to add checks to the PR.
  - A PAT with "content write" and "pull request write" can be used in cases where a GH_TOKEN can be used as well as when a PR is required and one or more checks in the PR must pass.
- semantic-release's builtin publish for npm and github releases might not meet our requirements and we may need to use npm cli and Github APIs for publishing a release.

## 7. High-Level Architecture (Initial Modularization)

| Module                 | Responsibility                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| core/release-calc.ts   | Invoke semantic-release dry-run, normalize output.                 |
| core/content-update.ts | Version bump + changelog update combined (simple, auditable).      |
| core/git.ts            | Branch create, commit, push, PR open, basic merge safety checks.   |
| core/publish.ts        | npm publish + GitHub Release creation.                             |
| core/guards.ts         | Race detection (new commits), minimal permission probes.           |
| core/capabilities.ts   | Inspect repo settings & token (non-admin) and suggest remediation. |
| cli/run-release.ts     | Orchestration CLI.                                                 |
| cli/setup.ts           | Interactive setup & diagnostic CLI.                                |

Others: TBD

Notes:

- Changelog + versioning intentionally merged for clarity & trust.
- No separate logging or config loader modules at this stage.

## 8. Testing Strategy

- Tests authored from requirements BEFORE implementation.
- Each module: write failing tests → implement → pass.
- Real external API capture and replay for test fixtures
- Recapture of APIs during maintenance if API change
- Package to use: Mocha v11.7, Chai v6, Sinon v21, nock 14.10+, c8 for code coverage

## 9. Definition of Done

- Test coverage of higher than 75% all passing
- Integration test covers dry-run → PR creation flow.
- Docs (README.md ) updated.
- Successful real publish to npm and github of our package using our own package.

## 10. Out of scope:

- Multi-package workspace orchestration including mono-repos.
- Release notes templating or end user customization.
- Provenance attestations / SLSA integration.
- Automatic retry policies for transient GitHub or npm outages.
- Dashboards other than what Github already provides with workflows.
- Extended branch enforcement telemetry: linear history, conversation resolution, force-push/delete restrictions.
- Accurate code scanning & signed commits enforcement detection
- Minimum PAT scope recommendation if a user has provided a PAT with more permissions than required
- Rate limit / API error summarization

## 11. Token & Setup Strategy (New)

- Setup CLI Flow:
  1. Gather repo metadata & protections.
  2. Enumerate required operations.
  3. Probe current token(s) (non-admin scope only).
  4. Compute diff → human-readable recommendations (no hashing).
  5. Provide manual instructions for adding PAT (tool never transmits secrets).
- Recommendation Engine: minimal required scopes only; admin actions out of scope (manual instructions instead).
- Runtime Diagnostics: pre-flight summary in console; on failure show cause + remediation.
- Security: never echo raw tokens; no fingerprints; no persistent secret storage.

### 11.1 Fine‑Grained PAT Policy

Only fine‑grained Personal Access Tokens are supported. Classic (legacy) PATs are not and will not be supported.

- Minimal permission set:
  - Contents: Read and Write (always)
  - Metadata: Read (implicit)
  - Pull requests: Read and Write (always)

## 12. Capability API Output

Split between repository info (static per repo state) and token info (per credential assessment).

Repository info fields (enumerations exactly as surfaced):

```
branchProtection: none, classic, rules, classic+rules, unknown
defaultBranch: string, unkown
visibility: public, private, unkwon
autoMergeEnabled: true, false, unkown
allowSquashMerge: true, false., unkown
requiredStatusChecksEnabled: true, false, unkwon
requiredStatusCheckContexts: true, false, unkwon
prRequired: true, false, unkwon
```

Token info (derived per token, full specs TBD):

- usableTokens: string[] (tokens meeting minimal push + list + read criteria)
- tokenMatrix[token]: { valid, repoRead, canListBranches, canReadBranchProtection, isAdmin, canPush }
- capabilityMinimumTokens: heuristic ordering (least privilege first) for internal capabilities (repo-read, branch-list, push, branch-protection-read, release-basic)
- gaps: currently only (usable-token, allow-squash-merge)

See `docs/TOKEN_EXPERIMENTS.md` for empirical recording of unknown field occurrences per token variation to identify criteria for heuristic of other methods for assessing provided tokens.
