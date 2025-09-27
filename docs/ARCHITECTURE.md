# Architecture Overview

This document explains the target modular architecture for `semantic-auto-release` as it transitions away from bash + ad‑hoc workflows toward a testable Node.js core.

## Goals

- Deterministic, replayable release calculation.
- Minimal surface area for side-effects (git, network, filesystem) to ease testing.
- Separation of policy (what should happen) from plumbing (GitHub/npm calls).
- Align with Product Requirements (Node.js LTS >= 20).

## Layering

```
+-----------------------------+
|         CLI / Runner        |
+-----------------------------+
|        Orchestration        |
+-----------------------------+
|  Core Domain Modules        |
+-----------------------------+
|   Adapters (GitHub, npm)    |
+-----------------------------+
|  Infra (logging, config)    |
+-----------------------------+
```

## Module Responsibilities (Initial Simplified Set)

- Orchestrator: calc → content update (version + changelog) → branch/PR → merge → publish → cleanup.
- Release Calc: semantic-release dry-run normalization.
- Content Update: Apply version bump + changelog modifications together (split later only if necessary).
- Git Adapter: Minimal Octokit wrapper (create branch, commit, push, open PR, optional merge probe, tag, release).
- NPM Adapter: Auth + publish + basic post-publish integrity check.
- Guards: Detect race (new commits) and visible permission gaps pre-flight.
- Capabilities: Inspect repo settings + token (non-admin scope) to recommend minimal fixes.

## Data Contracts

### ReleaseCalcResult

```
{
  version: string,
  notes: string,
  defaultBranch: string,
  baseCommit: string,
  calculatedAt: string (ISO)
}
```

### PublishPlan

```
{
  version: string,
  tag: string,            // e.g. v1.4.0
  npmDistTag: string,     // configurable later
  changelogFile: string,
  branchName: string
}
```

## Error Taxonomy

| Type               | Purpose                      | Example             |
| ------------------ | ---------------------------- | ------------------- |
| ConfigError        | Misconfiguration halts early | Missing NPM_TOKEN   |
| PermissionError    | Token lacks capability       | Cannot push branch  |
| RaceConditionError | New commits after calc       | Head SHA changed    |
| TransientError     | Retry recommended            | 502 from GitHub API |
| UnexpectedError    | Catch-all failsafe           | Unhandled code path |

## Testing Strategy Mapping

| Module       | Test Type                              |
| ------------ | -------------------------------------- |
| Changelog    | Unit (pure)                            |
| Versioning   | Unit (pure) + integration (file write) |
| Release Calc | Integration (mock semantic-release)    |
| Git Adapter  | Unit (stub Octokit) + contract tests   |
| Orchestrator | Integration (mock adapters)            |
| Race Guard   | Unit                                   |

## Migration Phases

1. Introduce new modules under `src/` while keeping existing scripts functional.
2. Write adapters + pure modules with tests using existing scenario JSON as fixtures.
3. Implement orchestrator & CLI.
4. Update GitHub workflow to call new CLI (keep old path behind feature flag env var for rollback).
5. Remove old bash scripts after stabilization window.

## Observability

- Plain console logging only (info/warn/error). No structured JSON initially.
- Optional verbose mode behind `SEMANTIC_AUTO_RELEASE_VERBOSE=1`.
- Temporary artifacts (e.g., version + notes) limited to what the workflow needs; not a public contract.

## Security Considerations

- Never log tokens or partial fingerprints (out of scope).
- Use env-provided credentials directly; avoid persisting auth.
- Validate changelog write path to avoid directory traversal.
- Admin-scope operations out of initial scope; instruct manual remediation instead.

## (Removed) Open Design Topics

Deferred until core flow stabilizes.

---

Created: 2025-09-08
