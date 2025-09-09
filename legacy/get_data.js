#!/usr/bin/env node

/**
 * GitHub Repo Data Gathering Script (Multi-token, Step-grouped, Separate Files)
 *
 * Collects:
 *  - Step 1: Main branch info
 *  - Step 2: Classic branch protection
 *  - Step 3: Rules-based branch protection
 *  - Step 4: Branch metadata
 *  - Step 5: Collaborator permission (optional)
 *  - Step 6: Branch list
 *
 * Output:
 *  - Prints all results to console (for CI copy-paste)
 *  - Writes one JSON file per step, each containing results for all tokens
 */

const fs = require("fs");
const path = require("path");

const {
  REPO_OWNER,
  REPO_NAME,
  PAT_ADMIN,
  PAT_CONTENT_PR_STATUS,
  PAT_CONTENT_PR,
  PAT_MIN,
  PAT_BAD,
  GH_TOKEN,
} = process.env;

if (!REPO_OWNER || !REPO_NAME) {
  console.error("❌ REPO_OWNER and REPO_NAME must be set.");
  process.exit(1);
}

// Build token list, skipping GH_TOKEN if not set (e.g., local runs)
const TOKENS = [];
if (GH_TOKEN) TOKENS.push({ type: "GH_TOKEN", value: GH_TOKEN });
if (PAT_ADMIN) TOKENS.push({ type: "PAT_ADMIN", value: PAT_ADMIN });
if (PAT_CONTENT_PR_STATUS)
  TOKENS.push({ type: "PAT_CONTENT_PR_STATUS", value: PAT_CONTENT_PR_STATUS });
if (PAT_CONTENT_PR)
  TOKENS.push({ type: "PAT_CONTENT_PR", value: PAT_CONTENT_PR });
if (PAT_MIN) TOKENS.push({ type: "PAT_MIN", value: PAT_MIN });
if (PAT_BAD) TOKENS.push({ type: "PAT_BAD", value: PAT_BAD });

if (TOKENS.length === 0) {
  console.error("❌ No authentication tokens found.");
  process.exit(1);
}

console.log(`ℹ️ Testing with tokens: ${TOKENS.map((t) => t.type).join(", ")}`);

const BASE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

async function callGitHub(token, endpoint) {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "repo-data-gatherer",
      },
    });
  } catch (err) {
    return {
      endpoint: url,
      status_code: null,
      ok: false,
      data: { fetch_error: err.message },
    };
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { parse_error: e.message };
  }

  return {
    endpoint: url,
    status_code: res.status,
    ok: res.ok,
    data,
  };
}

(async () => {
  const results = {
    step1_main_branch: {},
    step2_classic_protection: {},
    step3_rules_protection: {},
    step4_branch_metadata: {},
    step5_permissions_info: {},
    step6_branch_list: {},
  };

  for (const { type, value } of TOKENS) {
    // Step 1: Main branch info
    const mainBranchInfo = await callGitHub(value, "");
    results.step1_main_branch[type] = mainBranchInfo;

    let defaultBranch = null;
    if (mainBranchInfo.ok && mainBranchInfo.data.default_branch) {
      defaultBranch = mainBranchInfo.data.default_branch;
    }

    // Step 2: Classic branch protection
    if (defaultBranch) {
      results.step2_classic_protection[type] = await callGitHub(
        value,
        `/branches/${defaultBranch}/protection`,
      );
    } else {
      results.step2_classic_protection[type] = { skipped: true };
    }

    // Step 3: Rules-based branch protection
    if (defaultBranch) {
      results.step3_rules_protection[type] = await callGitHub(
        value,
        `/rules/branches/${defaultBranch}`,
      );
    } else {
      results.step3_rules_protection[type] = { skipped: true };
    }

    // Step 4: Branch metadata
    results.step4_branch_metadata[type] = await callGitHub(value, "");

    // Step 5: Collaborator permission
    try {
      const userRes = await callGitHub(value, "https://api.github.com/user");
      if (userRes.ok && userRes.data.login) {
        results.step5_permissions_info[type] = await callGitHub(
          value,
          `/collaborators/${userRes.data.login}/permission`,
        );
      } else {
        results.step5_permissions_info[type] = { skipped: true };
      }
    } catch (err) {
      results.step5_permissions_info[type] = { error: err.message };
    }

    // Step 6: Branch list
    results.step6_branch_list[type] = await callGitHub(value, "/branches");
  }

  // Write each step to its own file
  for (const [step, data] of Object.entries(results)) {
    const filePath = path.join(process.cwd(), `${step}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Print all results to console for CI copy-paste
  console.log(JSON.stringify(results, null, 2));
})();
