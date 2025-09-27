# Plan for Step 2: GitHub API data gathering

## Objective

Produce a Node.js script to collect GitHub API data for:

- Main branch identification
- Branch protection details (classic and rules-based)
- Branch metadata (merge types, auto-merge, delete branch on merge)
- Token capability scenarios (local PATs vs CI GH_TOKEN)

---

## Approach

### Structure

- **Single script:** Gather all required data in one run to minimize file count.
- **Single JSON output:** One file containing all collected data, grouped by section.
- **Configuration via env:** REPO_OWNER, REPO_NAME, PAT_ADMIN, PAT_CONTENT_PR, PAT_CONTENT_PR_STATUS, GH_TOKEN.
- **Token auto-detection:** Prefer GH_TOKEN if present (CI), otherwise fall back to PATs (local).
- **Per-section context:** Include token_type used, endpoint(s) queried, and raw API response.

### API endpoints

- **Main branch:** GET /repos/{owner}/{repo}
- **Classic branch protection:** GET /repos/{owner}/{repo}/branches/{branch}/protection
- **Rules-based branch protection:** GET /repos/{owner}/{repo}/rules/branches/{branch}
- **Branch metadata:** GET /repos/{owner}/{repo}
  - **Parse fields:** allow_merge_commit, allow_squash_merge, allow_rebase_merge, delete_branch_on_merge, allow_auto_merge
- **Additional metadata (optional):**
  - **Token effective permission:** GET /repos/{owner}/{repo}/collaborators/{username}/permission
  - **Branch list/default:** GET /repos/{owner}/{repo}/branches

### Token scenarios

- **Local PATs:**
  - **PAT_ADMIN:** Admin permissions
  - **PAT_CONTENT_PR_STATUS:** Non-admin, content and PR permissions
  - **PAT_CONTENT_PR:** Minimal permissions
- **GitHub Actions (GH_TOKEN):**
  - **GH_TOKEN with contents and PR write**
  - **GH_TOKEN with admin**
  - **GH_TOKEN with no preset permissions**

---

## Execution flow

1. **Identify main branch:** Store in main_branch section.
2. **Get classic protection:** Store in classic_protection section.
3. **Get rules-based protection:** Store in rules_protection section.
4. **Get branch metadata:** Store in branch_metadata section.
5. **Optional metadata:** Store in permissions_info and branch_list sections.

---

## Output

- **One JSON file per run:** e.g., repo_protection_data.json.
- **Top-level keys:** token_type, main_branch, classic_protection, rules_protection, branch_metadata, permissions_info (optional), branch_list (optional).
- **Each section includes:** endpoint (string or list), data (raw API response), status (success or fail), error (if any).
- **No timestamps:** Context is conveyed by token_type and endpoint references.

---

## Manual testing

- **Adjust settings between runs:** Cover classic vs rules protections and varying permissions.
- **Keep outputs separate by scenario:** Label by token_type and scenario in filename.
