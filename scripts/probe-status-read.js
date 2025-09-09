#!/usr/bin/env node
/**
 * Read-only probe to compare tokens for ability to read commit statuses / check runs on recent PRs.
 * Goal: determine if a token with 'statuses' (read) permission surfaces more detail than one without.
 * No mutations performed.
 */

const fetch =
  global.fetch || ((...a) => import("node-fetch").then((m) => m.default(...a)));

function repoFromEnv() {
  const full = process.env.SAR_REPO || process.env.GITHUB_REPOSITORY;
  if (!full) throw new Error("Set SAR_REPO=owner/repo");
  const [owner, repo] = full.split("/");
  return { owner, repo };
}

async function gh(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "status-read-probe",
    },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }
  return {
    status: res.status,
    ok: res.ok,
    data,
    rate: res.headers.get("x-ratelimit-remaining"),
  };
}

async function main() {
  const { owner, repo } = repoFromEnv();
  const tokens = Object.keys(process.env).filter((k) =>
    /PAT_CONTENT_PR_STATUS|PAT_CONTENT_PR|PAT_MIN|PAT_ADMIN/.test(k),
  );
  if (!tokens.length) {
    console.error("No candidate PAT env vars found.");
    process.exit(1);
  }

  // Get recent open or recently closed PRs (limit 5)
  const tokenForListing = process.env.PAT_ADMIN || process.env[tokens[0]];
  const prsResp = await gh(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=50`,
    tokenForListing,
  );
  if (!prsResp.ok) {
    console.error("Failed to list PRs", prsResp.status);
    process.exit(2);
  }
  const prs = Array.isArray(prsResp.data) ? prsResp.data : [];
  if (!prs.length) {
    console.log("No PRs found to probe.");
    process.exit(0);
  }

  const target = prs
    .map((p) => ({ number: p.number, headSha: p.head?.sha, title: p.title }))
    .filter((p) => p.headSha)
    .slice(0, 10);
  if (!target.length) {
    console.log("No PRs with head sha found.");
    process.exit(0);
  }

  const rows = [];
  for (const t of tokens) {
    const tokenVal = process.env[t];
    if (!tokenVal) continue;
    for (const pr of target) {
      const statusUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${pr.headSha}/status`;
      const checksUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${pr.headSha}/check-runs`;
      const statusResp = await gh(statusUrl, tokenVal);
      const checksResp = await gh(checksUrl, tokenVal);
      // Summaries
      const combinedState = statusResp.data?.state;
      const contexts = (statusResp.data?.statuses || []).map((s) => s.context);
      const checkCount = Array.isArray(checksResp.data?.check_runs)
        ? checksResp.data.check_runs.length
        : undefined;
      const conclusions = (checksResp.data?.check_runs || [])
        .map((c) => c.conclusion)
        .filter(Boolean);
      rows.push({
        token: t,
        pr: pr.number,
        statusCode: statusResp.status,
        state: combinedState,
        ctxCount: contexts.length,
        sampleCtx: contexts.slice(0, 2).join(","),
        checksCode: checksResp.status,
        checkRuns: checkCount,
        conclusions: conclusions.slice(0, 2).join(","),
      });
    }
  }

  // Output table
  const header = [
    "Token",
    "PR",
    "/status",
    "state",
    "ctxs",
    "ctxSample",
    "/check-runs",
    "runs",
    "sampleConclusions",
  ];
  console.log(header.join(" | "));
  console.log(header.map(() => "---").join(" | "));
  for (const r of rows) {
    console.log(
      [
        r.token,
        r.pr,
        r.statusCode,
        r.state || "",
        r.ctxCount,
        r.sampleCtx,
        r.checksCode,
        r.checkRuns ?? "",
        r.conclusions,
      ].join(" | "),
    );
  }

  console.log(
    "\nInterpretation: If PAT_CONTENT_PR_STATUS consistently returns more contexts or non-empty state while PAT_CONTENT_PR does not, statuses read permission adds value. If identical, we likely don't require the additional permission.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
