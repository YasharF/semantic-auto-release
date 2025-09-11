#!/usr/bin/env node
/**
 * probe-checks-vs-statuses.js
 * Diff modern check runs vs legacy status contexts for a commit.
 * Usage:
 *   REPO_OWNER=owner REPO_NAME=repo SHA=<commit-sha> TOKEN=<pat> node scripts/probe-checks-vs-statuses.js
 */
const https = require("https");

const { REPO_OWNER, REPO_NAME, SHA, TOKEN } = process.env;
if (!REPO_OWNER || !REPO_NAME || !SHA || !TOKEN) {
  console.error("Missing env vars. Need REPO_OWNER, REPO_NAME, SHA, TOKEN");
  process.exit(1);
}

function gh(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method: "GET",
        headers: {
          "User-Agent": "checks-vs-statuses-probe",
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(buf));
          } catch {
            resolve(buf);
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  const checks = await gh(
    `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${SHA}/check-runs`,
  );
  const legacy = await gh(
    `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${SHA}/status`,
  );
  const runNames = (checks.check_runs || []).map((r) => r.name).sort();
  const legacyNames = (legacy.statuses || []).map((s) => s.context).sort();
  const onlyChecks = runNames.filter((n) => !legacyNames.includes(n));
  const onlyLegacy = legacyNames.filter((n) => !runNames.includes(n));
  const both = runNames.filter((n) => legacyNames.includes(n));
  const summary = {
    sha: SHA,
    checkRunCount: runNames.length,
    legacyStatusCount: legacyNames.length,
    intersectionCount: both.length,
    onlyChecks,
    onlyLegacy,
    both,
  };
  console.log(JSON.stringify(summary, null, 2));
})();
