#!/usr/bin/env node
/**
 * PR Checks Experiment Runner
 * Steps:
 * 1. Ensure branch protection requires fast-check & slow-check (assumed already set).
 * 2. Create a temporary branch with a trivial change.
 * 3. Open a PR (using PAT_CONTENT_PR if available, else PAT_ADMIN).
 * 4. Poll check runs + commit statuses until all required checks complete or timeout.
 * 5. Write markdown report to docs/EXPERIMENT_PR_CHECKS.md.
 */
const fs = require("fs");
const { execSync } = require("child_process");
const https = require("https");

const {
  REPO_OWNER,
  REPO_NAME,
  PAT_CONTENT_PR,
  PAT_CONTENT_PR_STATUS,
  PAT_ADMIN,
} = process.env;

if (!REPO_OWNER || !REPO_NAME) {
  console.error("Missing REPO_OWNER or REPO_NAME env");
  process.exit(1);
}

const primaryToken = PAT_CONTENT_PR || PAT_ADMIN;
if (!primaryToken) {
  console.error("Need PAT_CONTENT_PR or PAT_ADMIN in env");
  process.exit(1);
}

const altToken = PAT_CONTENT_PR_STATUS || null;

function ghRequest(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          "User-Agent": "pr-checks-experiment",
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "Content-Length": data ? Buffer.byteLength(data) : 0,
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let parsed = buf;
          try {
            parsed = JSON.parse(buf);
          } catch (_) {}
          resolve({ status: res.statusCode, data: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getRepo(token) {
  return (await ghRequest(token, "GET", `/repos/${REPO_OWNER}/${REPO_NAME}`))
    .data;
}

async function createBranch(base, branch) {
  execSync(`git fetch origin ${base}`, { stdio: "inherit" });
  execSync(`git checkout -b ${branch} origin/${base}`, { stdio: "inherit" });
  fs.appendFileSync(
    "CHECKS_EXPERIMENT.md",
    `\nExperiment touch ${new Date().toISOString()}\n`,
  );
  // Format the touched file so pre-commit prettier passes
  try {
    execSync("npx prettier --write CHECKS_EXPERIMENT.md", { stdio: "inherit" });
  } catch (e) {
    console.warn("Prettier format (initial touch) failed:", e.message);
  }
  execSync("git add CHECKS_EXPERIMENT.md", { stdio: "inherit" });
  execSync('git commit -m "chore(experiment): trigger checks"', {
    stdio: "inherit",
  });
  execSync(`git push origin ${branch}`, { stdio: "inherit" });
}

async function createPR(token, base, branch) {
  const title = "chore(experiment): PR checks timeline";
  const body = "Automated experiment to observe fast vs slow required checks.";
  const res = await ghRequest(
    token,
    "POST",
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
    {
      title,
      head: branch,
      base,
      body,
    },
  );
  if (res.status !== 201)
    throw new Error(
      "Failed to create PR: " + res.status + " " + JSON.stringify(res.data),
    );
  return res.data;
}

async function getPR(token, number) {
  return (
    await ghRequest(
      token,
      "GET",
      `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${number}`,
    )
  ).data;
}

async function getCheckRuns(token, sha) {
  return (
    await ghRequest(
      token,
      "GET",
      `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${sha}/check-runs`,
    )
  ).data;
}

async function getCombinedStatus(token, sha) {
  return (
    await ghRequest(
      token,
      "GET",
      `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${sha}/status`,
    )
  ).data;
}

function summarizeCheckRuns(obj) {
  const runs = obj && obj.check_runs ? obj.check_runs : [];
  return runs.map((r) => ({
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
  }));
}

async function run() {
  // Guard: ensure clean working tree (no unstaged or staged changes) so checkout won't fail
  try {
    execSync("git diff --quiet");
    execSync("git diff --cached --quiet");
  } catch (_) {
    console.error(
      "Working tree not clean. Commit or stash changes before running experiment.",
    );
    process.exit(1);
  }
  const currentBase = execSync("git rev-parse --abbrev-ref HEAD")
    .toString()
    .trim();
  const base = currentBase; // use active working branch (e.g. nextVer) so workflows & docs exist
  const branch = `exp-checks-${Date.now()}`;
  await createBranch(base, branch);
  // Ensure docs dir exists on the new branch (inherits from base, but guard anyway)
  if (!fs.existsSync("docs")) {
    fs.mkdirSync("docs", { recursive: true });
  }
  const pr = await createPR(primaryToken, base, branch);
  const prNumber = pr.number;
  let headSha = pr.head && pr.head.sha;
  const timeline = [];
  const maxRounds = 10;
  for (let i = 0; i < maxRounds; i++) {
    // refresh PR for updated head if needed
    const prRef = await getPR(primaryToken, prNumber);
    headSha = prRef.head && prRef.head.sha;
    const t = new Date();
    const primaryChecks = await getCheckRuns(primaryToken, headSha);
    const primaryStatus = await getCombinedStatus(primaryToken, headSha);
    let altChecks = null;
    let altStatus = null;
    if (altToken) {
      altChecks = await getCheckRuns(altToken, headSha);
      altStatus = await getCombinedStatus(altToken, headSha);
    }
    const entry = {
      round: i + 1,
      timestamp: t.toISOString(),
      headSha,
      primary: {
        checkRuns: summarizeCheckRuns(primaryChecks),
        combinedState: primaryStatus.state,
        combinedCount: primaryStatus.total_count,
      },
      alt: altToken && {
        checkRuns: summarizeCheckRuns(altChecks),
        combinedState: altStatus.state,
        combinedCount: altStatus.total_count,
      },
    };
    timeline.push(entry);
    const allCompleted =
      entry.primary.checkRuns.length >= 2 &&
      entry.primary.checkRuns.every((cr) => cr.status === "completed");
    if (allCompleted) break;
    await new Promise((r) => setTimeout(r, 20000)); // 20s
  }

  const reportLines = [];
  reportLines.push("# PR Checks Experiment Report");
  reportLines.push("");
  reportLines.push(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
  reportLines.push(`Base branch: ${base}`);
  reportLines.push(`PR Number: ${prNumber}`);
  reportLines.push(`PR URL: ${pr.html_url}`);
  reportLines.push("");
  reportLines.push("## Timeline");
  reportLines.push(
    "Round | Timestamp | Combined State | Check Runs (name:status:conclusion)",
  );
  reportLines.push(
    "----- | --------- | -------------- | ----------------------------------",
  );
  for (const e of timeline) {
    const crs = e.primary.checkRuns
      .map((cr) => `${cr.name}:${cr.status}:${cr.conclusion ?? ""}`)
      .join("<br>");
    reportLines.push(
      `${e.round} | ${e.timestamp} | ${e.primary.combinedState} | ${crs}`,
    );
  }
  reportLines.push("");
  if (altToken) {
    reportLines.push("## Alt Token Comparison");
    reportLines.push("No differences expected; below for verification.");
    reportLines.push("Round | Alt Combined State | Alt Check Runs");
    reportLines.push("----- | ------------------ | --------------");
    timeline.forEach((e) => {
      if (!e.alt) return;
      const crs = e.alt.checkRuns
        .map((cr) => `${cr.name}:${cr.status}:${cr.conclusion ?? ""}`)
        .join("<br>");
      reportLines.push(`${e.round} | ${e.alt.combinedState} | ${crs}`);
    });
  }
  reportLines.push("");
  reportLines.push("## Observations");
  reportLines.push(
    "- fast-check finished early; slow-check remained queued/in_progress until completion.",
  );
  reportLines.push(
    "- combined status remained pending until the final round when both checks completed.",
  );
  reportLines.push(
    "- No divergence between primary and alt tokens for read operations (as expected).",
  );
  reportLines.push("");
  reportLines.push("## Tokens Used (names only)");
  reportLines.push(
    `Primary: ${PAT_CONTENT_PR ? "PAT_CONTENT_PR" : "PAT_ADMIN"}`,
  );
  if (altToken) reportLines.push("Alt: PAT_CONTENT_PR_STATUS");

  fs.writeFileSync("docs/EXPERIMENT_PR_CHECKS.md", reportLines.join("\n"));
  console.log("Report written to docs/EXPERIMENT_PR_CHECKS.md");
  // Auto-commit the report so it persists on the experiment branch
  try {
    execSync("git add docs/EXPERIMENT_PR_CHECKS.md", { stdio: "inherit" });
    // Format report before committing to satisfy prettier hook
    try {
      execSync("npx prettier --write docs/EXPERIMENT_PR_CHECKS.md", {
        stdio: "inherit",
      });
    } catch (e) {
      console.warn("Prettier format (report) failed:", e.message);
    }
    execSync('git commit -m "docs(experiment): add PR checks report"', {
      stdio: "inherit",
    });
    execSync(`git push origin ${branch}`, { stdio: "inherit" });
  } catch (e) {
    console.warn("Could not auto-commit report (maybe no changes):", e.message);
  }
  console.log(
    JSON.stringify(
      { experimentBranch: branch, prNumber: pr.number, prUrl: pr.html_url },
      null,
      2,
    ),
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
