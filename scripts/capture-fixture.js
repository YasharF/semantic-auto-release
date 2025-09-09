#!/usr/bin/env node
/*
 * Capture a live capability snapshot (steps1-6) into an output directory.
 * Usage:
 *   SAR_REPO=owner/repo OUTPUT=./out node scripts/capture-fixture.js
 * Optionally restrict tokens: TOKENS="PAT_ADMIN,PAT_MIN" node scripts/capture-fixture.js
 */
const fs = require("node:fs");
const path = require("node:path");

(async function main() {
  const repo =
    process.env.SAR_REPO ||
    process.env.GITHUB_REPOSITORY ||
    (process.env.REPO_OWNER && process.env.REPO_NAME
      ? `${process.env.REPO_OWNER}/${process.env.REPO_NAME}`
      : undefined);
  if (!repo) {
    console.error("Missing SAR_REPO env var (owner/repo).");
    process.exit(1);
  }
  const [owner, name] = repo.split("/");
  const outDir = process.env.OUTPUT || `capture_${Date.now()}`;
  fs.mkdirSync(outDir, { recursive: true });
  const tokenEnvAll = Object.keys(process.env).filter((k) =>
    /(GH_TOKEN|PAT_)/.test(k),
  );
  const tokenFilter = (process.env.TOKENS || "").split(",").filter(Boolean);
  const tokenEnv = tokenFilter.length
    ? tokenEnvAll.filter((t) => tokenFilter.includes(t))
    : tokenEnvAll;
  if (!tokenEnv.length) {
    console.error("No token env vars matching GH_TOKEN or PAT_* found.");
    process.exit(2);
  }
  const base = `https://api.github.com/repos/${owner}/${name}`;
  const defaultBranch = process.env.BRANCH || "main";

  async function ghGet(url, token) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "semantic-auto-release-capture",
      },
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { endpoint: url, status_code: res.status, ok: res.ok, data };
  }

  async function collect(stepName, builder) {
    const aggregate = {};
    for (const envName of tokenEnv) {
      const token = process.env[envName];
      if (!token) {
        aggregate[envName] = { skipped: true };
        continue;
      }
      try {
        aggregate[envName] = await builder(token, envName);
      } catch (e) {
        aggregate[envName] = { error: e.message };
      }
    }
    fs.writeFileSync(
      path.join(outDir, stepName + ".json"),
      JSON.stringify(aggregate, null, 2),
    );
    console.log("Wrote", stepName);
  }

  await collect("step1_main_branch", (token) => ghGet(base, token));
  await collect("step2_classic_protection", (token) =>
    ghGet(`${base}/branches/${defaultBranch}/protection`, token),
  );
  await collect("step3_rules_protection", (token) =>
    ghGet(`${base}/rules/branches/${defaultBranch}`, token),
  );
  await collect("step4_branch_metadata", (token) =>
    ghGet(`${base}/branches/${defaultBranch}`, token),
  );
  await collect("step5_permissions_info", (token) =>
    ghGet(`${base}/collaborators/${owner}/permission`, token),
  );
  await collect("step6_branch_list", (token) =>
    ghGet(`${base}/branches?per_page=100`, token),
  );

  console.log("Capture complete ->", outDir);
})();
