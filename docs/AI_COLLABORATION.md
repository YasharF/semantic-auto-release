# AI Collaboration Guidelines

Purpose: Provide a stable reference for collaborating with AI assistants during development of `semantic-auto-release`.

## Principles

- Deterministic outputs over ad-hoc shell scripting.
- Prefer pure functions; isolate side-effects.
- Small, test-first increments.
- All new behavior must have at least one automated test unless explicitly deferred.
- Target Node.js LTS >= 20 (match product requirements).

## Workflow for AI Contributions

1. Read `PRODUCT_REQUIREMENTS.md` and `ARCHITECTURE.md` before implementing changes.
2. When adding a module:
   - Define contract (inputs/outputs, errors) inline in JSDoc/TypeDoc style.
   - Add unit tests first when feasible.
3. Use scenario fixture data under `data_*` directories instead of live API calls for tests.
4. After implementing code, run local tests; only then propose changes.
5. Update docs if public behavior or architecture changes.

## Do / Avoid

| Do                          | Avoid                             |
| --------------------------- | --------------------------------- |
| Create focused modules      | Expanding bash scripts            |
| Add tests with each feature | Leaving logic untested            |
| Log structured events       | Printing unstructured debug noise |
| Reuse existing fixtures     | Duplicating large JSON inline     |

## Request Template

When the maintainer asks for a feature, extract a checklist:

```
Feature: <summary>
Checklist:
- [ ] Requirements enumerated
- [ ] Assumptions explicit
- [ ] Contracts drafted
- [ ] Tests authored/pending
- [ ] Implementation
- [ ] Verification (tests green)
- [ ] Docs updated
```

## Version Control Hygiene

- Group related changes (code + tests + docs) in one commit where practical.
- Conventional Commits format.
- No force pushes to protected branches.

## Communication Expectations

- Concise responses; no extraneous praise.
- Highlight risks & tradeoffs early.
- Ask for missing critical data only.

## Auto-Approved Commands

The AI assistant is pre-authorized to run the following without asking for confirmation each time:

- `npm test` (full test suite or targeted test invocations)
- `npm build` / `npm run build` (project build)
- Any non-destructive, read-only or diagnostic commands for data gathering (e.g. listing files, reading/grepping source, inspecting package metadata, showing git status/diff, counting lines, running node scripts that only read files).

Guidelines:

- Do NOT run destructive commands (delete, force push, rewriting history) without explicit approval.
- If a command might modify external state (publishing, releasing, pushing tags), request confirmation.
- When in doubt about side effects, ask first.

This section removes the need for repetitive permission checks for routine validation and context acquisition.

## Command Authorization Matrix

| Command / Pattern                                  | Category          | Mutates Repo State                | External Side Effects (Remote) | Auto-Approved                                            | Notes                                                                              |
| -------------------------------------------------- | ----------------- | --------------------------------- | ------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm test`                                         | Validation        | No                                | No                             | Yes                                                      | Full or filtered test runs.                                                        |
| `npm run build` / `npm build`                      | Build             | May create local artifacts (dist) | No                             | Yes                                                      | Local build artifacts only.                                                        |
| `node <script>` (read-only script)                 | Data Gathering    | No (unless script writes)         | No                             | Yes                                                      | Only if script reads files / prints output.                                        |
| `grep`, `rg`, `find`, `ls`, `cat`, `wc -l`         | Data Gathering    | No                                | No                             | Yes                                                      | Source/file introspection.                                                         |
| `git status` / `git diff --name-only` / `git diff` | Data Gathering    | No                                | No                             | Yes                                                      | Inspection only; no staging/commits.                                               |
| `git show <ref>:<path>`                            | Data Gathering    | No                                | No                             | Yes                                                      | Viewing historical content.                                                        |
| `head`, `tail`, `sed -n` (print-only)              | Data Gathering    | No                                | No                             | Yes                                                      | Non-mutating inspection.                                                           |
| `node -e "..."` (pure read)                        | Data Gathering    | No                                | No                             | Yes                                                      | Inline evaluation for quick parsing.                                               |
| `cat package.json` / parse dependency graph        | Data Gathering    | No                                | No                             | Yes                                                      | Metadata inspection.                                                               |
| `npm pack --dry-run`                               | Data Gathering    | No (temp files)                   | No                             | Yes                                                      | Verifies published content set.                                                    |
| `npm install` / adding deps                        | Dependency Change | Yes (modifies lockfile)           | May hit registry               | Yes                                                      | Summarize dependency delta afterward.                                              |
| `git add` / `git commit`                           | VCS Mutation      | Yes                               | No                             | Yes                                                      | Keep commits scoped (code+tests+docs).                                             |
| `git push` / `git tag`                             | Remote Mutation   | Yes                               | Yes                            | Yes                                                      | Auto-approved for iteration & data.                                                |
| `git push --force` / history rewrites              | Risky Mutation    | Yes                               | Yes                            | Forbidden                                                | Never run.                                                                         |
| `npm publish`                                      | Release           | No (local)                        | Yes (publishes package)        | Yes                                                      | Allowed for data/release flow capture.                                             |
| `gh release create`                                | Release           | No                                | Yes                            | Yes                                                      | Provide short release rationale.                                                   |
| Modify branch protection (enable/disable)          | Repo Settings     | Yes                               | Yes                            | Yes only until we officially release v1                  | Capture before/after state in summary.                                             |
| Delete branch (non-default)                        | Repo Mutation     | Yes                               | Yes                            | Yes only for branches that the app or tests are creating | Note branch name & reason.                                                         |
| Toggle security features (disable/enable)          | Repo Settings     | Yes                               | Yes                            | Yes                                                      | For data gathering (no restore required).                                          |
| `rm -rf` destructive patterns                      | Destructive       | Yes                               | No                             | Forbidden                                                | Never run (prefer explicit file deletes if needed with approval update to policy). |
| `sed -i`, bulk rewrite scripts                     | Mass Edit         | Yes                               | No                             | Forbidden                                                | Never run; perform explicit reviewed edits instead.                                |

Furthermore until we have officially released v1:

- Any modifications to GitHub repo settings (including disabling protections, security features, or changing visibility), branch protection rules, or branch deletions are Auto-approved for data gathering.
- Publishing releases, creating tags, and `npm publish` are Auto-approved for development and data gathering as part of test development.
- Calling GitHub Actions and workflows for data gathering is Auto-approved. Workflow YAMLs may be modified as needed.

Principles:

- Read-only & diagnostic => Auto-approved.
- Mutating operations (history, remote, dependencies, releases) are now Auto-approved under this policy.
- Ambiguous scripts default to Auto-approved unless explicitly risky beyond listed categories.

Escalation Rule:
Do not propose or execute forbidden commands. Pause only if an action might implicitly replicate their effect (e.g., deleting many files manually).

Forbidden Commands (hard block):

- `git push --force`
- `rm -rf` (any recursive removal)
- `sed -i` / bulk sed rewrites

---

Created: 2025-09-08
