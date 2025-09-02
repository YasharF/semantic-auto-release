## User-Facing Messages for PR Merge Flow

### Case A — No PAT provided, merge into protected branch fails

Condition:

- RELEASE_PAT not set.
- Merge attempt into protected branch fails.

Log (user):
ERROR: Pull request merge failed while using the action provided GITHUB_TOKEN.
If you have branch protection with required checks, set RELEASE_PAT in the workflow to a Personal Access Token from GitHub with fine-grain permissions: {Contents: Read & write, Pull requests: Read & write}

---

### Case B — PAT provided but invalid (made-up or revoked)

Condition:

- RELEASE_PAT set.
- Fails a simple auth check (gh api user or gh auth status).

Log (user):
ERROR: The provided Personal Access Token (RELEASE_PAT) is invalid.

---

### Case C — PAT valid but missing permissions to read checks

Condition:

- RELEASE_PAT set and passes auth check.
- Could not retrieve any check runs/statuses after 10 × 30s polls.
- Merge attempted.

Log (user) — Merge fails:
ERROR: Merge failed and we could not read PR checks or their status.
The RELEASE_PAT may be missing permissions: {Contents: Read & write, Pull requests: Read & write}

Log (user) — Merge succeeds:
WARNING: Merge succeeded but we could not read PR checks or their status.
If your pull requests have checks, verify that RELEASE_PAT has the required permissions: {Contents: Read & write, Pull requests: Read & write}

---

### Case 1.2 — Failing/timed-out check

Condition:

- Any check hits a failure or timed_out state before all succeed.

Log (user):
ERROR: Check "<name>" failed (<value>). Aborting the release process.

---

### Case 1.3 — Stuck/pending check

Condition:

- After N polling attempts a check is still queued, in_progress, pending, or action_required.

Log (user):
ERROR: Check "<name>" is still "<state>" after our timeout. Aborting the release process.
