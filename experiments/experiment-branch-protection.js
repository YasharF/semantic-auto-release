#!/usr/bin/env node
/**
 * Experiment: configure default branch protection requiring PRs + specific required status checks.
 * Uses PAT_ADMIN (env) for admin permission. Safe idempotent update.
 */
const https = require("https");

const {
  REPO_OWNER = process.env.REPO_OWNER,
  REPO_NAME = process.env.REPO_NAME,
  PAT_ADMIN,
} = process.env;

if (!REPO_OWNER || !REPO_NAME || !PAT_ADMIN) {
  console.error("REPO_OWNER, REPO_NAME, PAT_ADMIN env vars required");
  process.exit(1);
}

// Required checks to align with workflow job names
const requiredContexts = ["fast-check", "slow-check"];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          "User-Agent": "sem-auto-release-experiment",
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${PAT_ADMIN}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "Content-Length": data ? Buffer.byteLength(data) : 0,
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(buf || "{}"));
            } catch {
              resolve({});
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode} ${path}: ${buf}`));
          }
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getDefaultBranch() {
  const repo = await request("GET", `/repos/${REPO_OWNER}/${REPO_NAME}`);
  return repo.default_branch;
}

async function updateProtection(branch) {
  // See https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection
  const body = {
    required_status_checks: {
      strict: false,
      contexts: requiredContexts,
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      required_approving_review_count: 0,
    },
    restrictions: null,
    required_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: false,
    lock_branch: false,
    allow_fork_pushes: false,
    allow_fork_syncing: true,
  };
  await request(
    "PUT",
    `/repos/${REPO_OWNER}/${REPO_NAME}/branches/${branch}/protection`,
    body,
  );
  return body;
}

(async () => {
  try {
    const branch = await getDefaultBranch();
    const result = await updateProtection(branch);
    console.log(
      JSON.stringify(
        { branch, requiredContexts: result.required_status_checks.contexts },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("Failed to update protection:", e.message);
    process.exit(1);
  }
})();
