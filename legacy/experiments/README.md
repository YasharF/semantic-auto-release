Archived experiment assets (temporary evidence; not shipped in v1).

Contents:

- PR checks timeline experiment (run-checks-experiment.js) and report (EXPERIMENT_PR_CHECKS.md)
- Classic protection verification (verify-classic-checks.js)
- Probe tools (probe-checks-vs-statuses.js)

Run (optional):

- node experiments/run-checks-experiment.js
- node experiments/verify-classic-checks.js
- REPO_OWNER=... REPO_NAME=... SHA=... TOKEN=... node experiments/probe-checks-vs-statuses.js

Notes:

- The GitHub Actions workflow was disabled for v1. Manual runs are supported via node.
- These artifacts are preserved solely for auditability and can be removed post v1 if desired.
