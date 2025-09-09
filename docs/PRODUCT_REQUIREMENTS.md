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

## 3. User Stories

1. As a maintainer, I want a one-command setup that scaffolds the workflow, hooks, and configs so I can adopt the system quickly.
2. As a maintainer, I want each release to appear as a PR modifying only version + changelog so that history stays reviewable.
3. As a maintainer, I want the process to halt if unexpected commits appear after calculation so accidental version drift is avoided.
4. As a maintainer, I want releases to work even when branch protection requires PR reviews or status checks.
5. As a maintainer, I want to run the same logic locally for debugging with PATs before pushing.
6. As a maintainer, I want clear logs and artifacts (version, notes, default branch) to debug issues.
7. As a maintainer, I want the tooling to **tell me** (not make me guess) when my current tokens are insufficient and why.
8. As a security-conscious maintainer, I want recommendations for the **minimal** PAT scopes needed, not a blanket request for admin.
9. As a maintainer, I want release and controls systems to be updated without me having to figure out related library changes and have to manually make changes whenever underlying semantic release libraries or workflows require an update.

## 4. Functional Requirements

- Detect default branch using semantic-release internal resolution.
- Run semantic-release in dry-run to compute: next version, release notes, default branch.
- Write artifacts: `version.txt`, `notes.md`, `branch.txt` (or consolidated JSON later).
- Create ephemeral release branch: `temp_release_<runid>_<runnumber>`.
- Update version in `package.json` & `package-lock.json` atomically.
- Generate/append to changelog file (`CHANGELOG.md` or configurable) with new section only.
- Optionally Prettier-format changelog if repo or flag indicates.
- Open PR from ephemeral branch to default branch; idempotent if retried.
- Merge PR & publish only if no new commits on default branch since calc base commit.
- Publish to npm and create GitHub Release + tag.
- Delete ephemeral branch (remote) post-merge.
- Identifiable: Auto‑created PRs should indicate they were created by the automation tool.
- Documenter: If proper permissions are provided, comment on PRs whose merged commits are included in the release, indicating the release version.

### 4.1 Setup & Capability Detection (New)

- Inspect repository settings & branch protection (classic + rules-based and combined) to determine required operations (push branch, create PR, auto-merge, merge method availability, tag creation) and enforcement flags (PR required, status checks, code scanning, signed commits).
- Enumerate capabilities needed vs currently possessed by available tokens (`GH_TOKEN`, provided PATs).
- Prompt (interactive CLI) during setup for PAT only if a gap exists; list minimal scopes (e.g., `repo`, `workflow` if necessary) with justification.
- Provide remediation suggestions when lacking permissions (e.g., “Enable Actions permission: pull-requests: write” or “Add a PAT with repo:status to satisfy required status check re-run”).
- Emit a structured diagnostic summary (JSON + human-readable) at the end of setup.

### 4.2 Runtime Permission Guardrails (New)

- Pre-flight phase: without creating anything in GitHub, identify the repo setup and settings that can impact the process given the available tokens.
- Fail fast with `PermissionError` before performing partial work if a required capability is missing.
- Classify missing capability root cause: token scope, repo setting (e.g., missing “Allow GitHub Actions to create and approve pull requests”), protection restriction, or environmental (e.g., missing env var `NPM_TOKEN`).
- Provide next-action guidance string in every permission failure.

## 5. Non-Functional Requirements

- Idempotent steps: rerunning after transient failure should not corrupt repo state.
- Observable: logs and summary outputs for each major phase.
- Maintainability: setup for optional log level parameters to provide more verbose logging for troubleshooting be developers.
- Testability: core logic separated from CLI/side-effects; unit tests use fixture repos + mocked GitHub API. Unit tests should be created based on the requirements with proper mocked GitHub API data prior to development of functions, code, etc.
- Modularity: no large bash scripts; Node modules with clear contracts.
- Extensibility: Initial version designed for npm, future support for mono-repos or multiple packages, yarn, pnpm.
- Self-cleaner: it should identify failure artifacts such as orphaned PRs or branches that might have been left in the repo from a failed prior run and close or delete them.

## 6. Constraints & Assumptions

- Single-package repository (initial scope).
- Node LTS environment (>=20) in GitHub Actions.
- Semantic release versioning and change log analysis leverages the semantic-release npm package.
- Conventional commit enforcement utilizes the commitlint npm package.

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
| adapters/github.ts     | Minimal Octokit wrapper (no heavy abstraction).                    |
| adapters/npm.ts        | Auth and publish wrapper.                                          |

Notes:

- Changelog + versioning intentionally merged for clarity & trust.
- No separate logging or config loader modules at this stage.

## 8. (Removed)

Prior "Data & Artifacts" section removed; internal temporary files are implementation details, not a public contract.

## 9. (Deferred)

Token capability matrix will be built incrementally as capability detection logic matures.

## 10. Error Handling Strategy

- Initial categories: ConfigError, PermissionError, RaceConditionError, UnexpectedError.
- Plain human-readable messages; no machine-parsable schema required now.
- Single non-zero exit codes for failures; with category and description in message.
- Add finer granularity only if external integrations require it later.

## 11. Testing Strategy

- Unit (Mocha + Chai + Sinon) authored from requirements BEFORE implementation.
- Each module: write failing tests → implement → pass.
- Integration: reuse recorded API JSON under `data_*` directories (treated as snapshots).
- On integration-found bugs: add/adjust unit test reproducing bug before fix.
- E2E & matrix CI deferred.

## 12. Migration from Current State

1. Move existing bash/workflow code into `legacy/` (archival, non-executed).
2. Implement modules test-first.
3. Create new GitHub workflow invoking Node orchestration.
4. Validate real publish path.
5. Remove `legacy/` once stable.

## 13. (Removed)

Open questions deferred—out of current scope.

## 14. Definition of Done (Initial Modular Release)

- Functional requirements (Sections 4–4.2) implemented.
- Legacy bash archived / not executed.
- Unit tests for every module; all pass.
- Integration test covers dry-run → PR creation flow.
- Docs (README + this file + architecture) updated.
- Successful real publish via Node path.

## 15. Future Enhancements (Backlog)

- Multi-package workspace orchestration.
- Release notes templating customization surface.
- PR comment bot summarizing pending release calc before merge.
- Provenance attestations / SLSA integration.
- Automatic retry policies for transient GitHub or npm outages.
- Web-based dashboard or CLI TUI for release pipeline status.
- Extended branch enforcement telemetry: linear history, conversation resolution, force-push/delete restrictions.
- Accurate code scanning & signed commits enforcement detection (currently placeholders only in v1).
- Minimum PAT scope recommendation engine (generic guidance only in v1).
- Rate limit / API error summarization (deferred; low call volume makes this non-critical now).

## 16. Token & Setup Strategy (New)

- Setup CLI Flow:
  1. Gather repo metadata & protections.
  2. Enumerate required operations.
  3. Probe current token(s) (non-admin scope only).
  4. Compute diff → human-readable recommendations (no hashing).
  5. Provide manual instructions for adding PAT (tool never transmits secrets).
- Recommendation Engine: minimal required scopes only; admin actions out of scope (manual instructions instead).
- Runtime Diagnostics: pre-flight summary in console; on failure show cause + remediation.
- Security: never echo raw tokens; no fingerprints; no persistent secret storage.

### 16.1 Fine‑Grained PAT Policy (Updated)

Only fine‑grained Personal Access Tokens are supported. Classic (legacy) PATs are not and will not be supported.

- Minimal permission set:
  - Contents: Read and Write (always)
  - Metadata: Read (implicit)
  - Pull requests: Read and Write (always)
  - Statuses: [To be determined]
  - Actions / Workflows: Not required for v1.

### 16.2 Deferred / Not in v1

Explicitly out of scope for the first release (tracked as backlog items above):

- Code scanning rule enforcement surfaced as a reliable flag
- Signed commits enforcement (ruleset + classic) beyond experimental detection
- Linear history / required conversation resolution flags
- Force-push / branch deletion restriction flags
- Automated minimum PAT scope diff & tailored recommendation list (generic message only)
- Rate limit budget / retry strategy reporting

---

Created: 2025-09-08 (Updated: 2025-09-08 for vision refinement & token strategy)

## 17. Capability Output (Current Surface)

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

Token info (not enumerated booleans, derived per token):

- usableTokens: string[] (tokens meeting minimal push + list + read criteria)
- tokenMatrix[token]: { valid, repoRead, canListBranches, canReadBranchProtection, isAdmin, canPush }
- capabilityMinimumTokens: heuristic ordering (least privilege first) for internal capabilities (repo-read, branch-list, push, branch-protection-read, release-basic)
- gaps: currently only (usable-token, allow-squash-merge)

See `docs/TOKEN_EXPERIMENTS.md` for ongoing empirical recording of unknown field occurrences per token variation.
