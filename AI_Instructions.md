# AI Instructions: Semantic-Release Workflow with Commit and Token/Branch Protection Handling

## Context

We are building a GitHub Actions workflow using `semantic-release` to publish packages to **npm** and **GitHub**.  
Unlike existing workflows, this one must also:

- Update `package.json` and `package-lock.json` versions.
- Update `CHANGELOG.md` if present.
- Commit these changes back to the repository.

This requires handling:

- Branch protection variations.
- Different token types and permission levels.
- Switching between **local testing** (using PATs) and **GitHub Actions testing** (using `GH_TOKEN`).

---

## Environment Variables

The following variables will be available in the environment:

| Variable                | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `REPO_OWNER`            | Repository owner (org or user)                                                   |
| `REPO_NAME`             | Repository name                                                                  |
| `PAT_ADMIN`             | Personal Access Token with admin-level permissions                               |
| `PAT_CONTENT_PR`        | Personal Access Token with minimal permissions                                   |
| `PAT_CONTENT_PR_STATUS` | Personal Access Token with content + PR creation permissions                     |
| `GH_TOKEN`              | GitHub Actions-provided token (permissions set in workflow `permissions:` block) |

---

## Process Rules

1. Work will proceed **step-by-step**.
   - Do **not** move to the next step until explicitly told to do so.
2. Responses must be **short, precise, concise, and actionable**.
   - No praise, no agreement statements, no fluff.
3. If an issue is pointed out, review it and state directly if a mistake was made.
4. All deliverables are to be **completed by the AI** — no instructions for the user to perform task.
5. If you are missing a data, do not make assumptions, ask for the data and why you need it in 3 sentences or less.
6. Always anchor outputs in **current GitHub API behavior** and **reproducible workflows**.

---

## Testing Phases

### Phase 1 — Local Testing

- **Tokens Used:** `PAT_ADMIN`, `PAT_CONTENT_PR`, `PAT_CONTENT_PR_STATUS`
- **Purpose:** Validate scripts and API calls without deploying to GitHub Actions.
- **Notes:**
  - Use `PAT_CONTENT_PR` for read-only operations.
  - Use `PAT_CONTENT_PR_STATUS` for content updates and PR creation.
  - Use `PAT_ADMIN` only for admin-level API calls.

### Phase 2 — GitHub Actions Testing

- **Token Used:** `GH_TOKEN` (permissions defined in workflow YAML)
- **Purpose:** Validate workflow behavior in CI.
- **Notes:**
  - Configure `permissions:` in workflow file to match required actions.
  - `GH_TOKEN` is **not** available locally.

---

## Step 1

Write these AI instructions in **Markdown** (this document).

---

## Step 2

Prepare **Node.js** code to gather GitHub API output data for later analysis.  
Data gathering will be split into multiple sub-steps to cover all dimensions.

### Data to Gather

A. **Identify main branch**  
B. **Identify branch protection**

- Account for multiple possible protection configurations.
- Settings will be manually changed between scenarios for testing.

C. **Identify branch metadata**

- Merge types allowed
- Auto-merge enabled/disabled
- Branch delete on merge enabled/disabled

D. **Determine commit message safety** (Y/N)

- Whether we can push a commit message under current settings.

---

## Token Scenarios

We may have only the **workflow-provided `GH_TOKEN`**:

1. `GH_TOKEN` has sufficient permissions.
2. `GH_TOKEN` lacks sufficient permissions.

We may have a **GitHub Personal Access Token (PAT)**:

1. `PAT_ADMIN` — admin permissions.
2. `PAT_CONTENT_PR_STATUS` — non-admin but sufficient permissions for content + PR.
3. `PAT_CONTENT_PR` — non-admin and minimal permissions.

---

## Notes

- For data gathering, PATs with various access levels will be provided.
- All code must be **self-contained** and **ready to run** in a GitHub Actions or local Node.js environment.
- Scripts must detect whether they are running locally or in CI and select the appropriate token automatically.
