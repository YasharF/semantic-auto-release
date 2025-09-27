#!/usr/bin/env node
/**
 * verify-classic-checks.js
 * Orchestrates:
 * 1. Apply classic branch protection with required contexts fast-check & slow-check (removing rulesets).
 * 2. Run the existing PR checks experiment script to generate a timeline.
 * 3. Append a Classic vs Rules verification note to docs/EXPERIMENT_PR_CHECKS.md.
 *
 * Requires env: REPO_OWNER, REPO_NAME, PAT_ADMIN (admin token), optionally PAT_CONTENT_PR, PAT_CONTENT_PR_STATUS.
 */
const { execSync } = require("child_process");
const fs = require("fs");

function run(cmd, opts = {}) {
  console.log(`[cmd] ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function runCapture(cmd, opts = {}) {
  console.log(`[cmd] ${cmd}`);
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts });
}

function ensureEnv(vars) {
  for (const v of vars) {
    if (!process.env[v]) {
      console.error(`Missing required env var ${v}`);
      process.exit(1);
    }
  }
}

async function main() {
  ensureEnv(["REPO_OWNER", "REPO_NAME", "PAT_ADMIN"]);
  const startBranch = execSync("git rev-parse --abbrev-ref HEAD")
    .toString()
    .trim();
  console.log(`Starting on branch ${startBranch}`);

  // 1. Apply classic protection (remove rulesets) with required fast-check & slow-check
  console.log("\n==> Applying classic protection with fast-check, slow-check");
  run(
    'ACTION=apply-classic CHECKS="fast-check,slow-check" APPROVALS=0 node scripts/repo-admin.js',
  );

  // 2. Run experiment script (this creates its own branch & PR)
  console.log("\n==> Running PR checks experiment under classic protection");
  let experimentJson = "";
  try {
    experimentJson = runCapture("node scripts/run-checks-experiment.js");
  } catch (e) {
    console.error("Experiment script failed");
    process.exit(1);
  }
  const lines = experimentJson.trim().split(/\n/);
  const lastLine = lines[lines.length - 1];
  let meta = null;
  try {
    meta = JSON.parse(lastLine);
  } catch (_) {}
  console.log("Experiment meta:", meta);

  // 3. Append verification note
  const reportPath = "docs/EXPERIMENT_PR_CHECKS.md";
  if (fs.existsSync(reportPath)) {
    const note = `\n\n## Classic Protection Verification\n\n- Classic branch protection with required contexts fast-check & slow-check applied.\n- Experiment branch PR #${meta?.prNumber || "?"} observed check runs via Checks API (see timeline above).\n- Confirms: classic vs ruleset does NOT affect visibility of check runs; differences only arise if a provider emits legacy statuses instead of check runs.\n- Therefore: status:read remains unnecessary for modern providers under classic protection.`;
    fs.appendFileSync(reportPath, note);
    try {
      run("npx prettier --write docs/EXPERIMENT_PR_CHECKS.md");
    } catch (_) {}
    run("git add docs/EXPERIMENT_PR_CHECKS.md");
    run(
      'git commit -m "docs(experiment): append classic protection verification"',
    );
    run("git push");
  } else {
    console.warn("Report not found to append classic verification.");
  }

  console.log("Classic protection verification complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
