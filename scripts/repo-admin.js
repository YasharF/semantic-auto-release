#!/usr/bin/env node
/*
 * Repository administration helper (mutation operations) – USE WITH CARE.
 * Allows scripted switching between public/private visibility, applying/removing
 * classic branch protection, creating/deleting rulesets, toggling auto‑merge,
 * and orchestrated scenario capture for capability fixtures.
 *
 * All actions require an admin‑scoped token for the target repository.
 * We look for the first present env var among: ADMIN_TOKEN, PAT_ADMIN, GH_TOKEN, GITHUB_TOKEN.
 * You should prefer a fine‑scoped PAT (repo + admin:repo_hook) and set it as PAT_ADMIN.
 *
 * Usage examples:
 *   SAR_REPO=owner/repo ACTION=set-visibility VISIBILITY=public node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=apply-classic CHECKS="build,test" APPROVALS=2 node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=remove-classic node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=apply-ruleset CHECKS="build,test" APPROVALS=2 node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=delete-rulesets node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=enable-auto-merge ENABLE=true node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=capture-scenario SCENARIO=classic CHECKS="build,test" APPROVALS=2 OUTPUT=classic_real node scripts/repo-admin.js
 *   SAR_REPO=owner/repo ACTION=capture-scenario SCENARIO=rules CHECKS="build,test" APPROVALS=2 OUTPUT=rules_real node scripts/repo-admin.js
 *
 * SCENARIO values for capture-scenario:
 *   classic – make repo public (if not already), remove rulesets, apply classic protection, capture fixture.
 *   rules   – remove classic protection, create a ruleset, capture fixture.
 *   automerge – enable auto merge (repo must allow), capture fixture.
 */
const { execSync } = require("node:child_process");

async function main() {
  const repo =
    process.env.SAR_REPO ||
    process.env.GITHUB_REPOSITORY ||
    (process.env.REPO_OWNER && process.env.REPO_NAME
      ? `${process.env.REPO_OWNER}/${process.env.REPO_NAME}`
      : undefined);
  if (!repo) fatal("Missing SAR_REPO (owner/repo)");
  const [owner, name] = repo.split("/");
  const token =
    process.env.ADMIN_TOKEN ||
    process.env.PAT_ADMIN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN;
  if (!token) fatal("Missing admin token (set ADMIN_TOKEN or PAT_ADMIN)");
  const action = (process.env.ACTION || "").trim();
  if (!action) fatal("Set ACTION env var");
  const base = `https://api.github.com/repos/${owner}/${name}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "semantic-auto-release-admin",
    Accept: "application/vnd.github+json",
  };

  async function gh(method, url, body) {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(
        `${method} ${url} -> ${res.status} ${res.statusText}: ${text.slice(0, 300)}`,
      );
    }
    return data;
  }

  async function setVisibility(vis) {
    if (!["public", "private"].includes(vis))
      fatal("VISIBILITY must be public|private");
    const body = { private: vis === "private" };
    const data = await gh("PATCH", base, body);
    log(`Repo visibility now: ${data.private ? "private" : "public"}`);
  }

  async function enableAutoMerge(enable) {
    const data = await gh("PATCH", base, { allow_auto_merge: enable });
    log(`allow_auto_merge: ${data.allow_auto_merge}`);
  }

  async function removeClassicProtection(branch) {
    const url = `${base}/branches/${branch}/protection`;
    const res = await fetch(url, { method: "DELETE", headers });
    if (res.status === 404) {
      log("Classic protection already absent");
      return;
    }
    if (!res.ok) throw new Error(`DELETE classic protection ${res.status}`);
    log("Classic protection removed");
  }

  async function applyClassicProtection(branch, checks, approvals) {
    // Minimal classic protection body
    const body = {
      required_status_checks: checks.length
        ? { strict: true, contexts: checks }
        : null,
      enforce_admins: true,
      required_pull_request_reviews:
        approvals > 0 ? { required_approving_review_count: approvals } : null,
      restrictions: null,
      allow_deletions: false,
      allow_force_pushes: false,
      required_linear_history: false,
      allow_auto_merge: true,
      block_creations: false,
      required_conversation_resolution: false,
      lock_branch: false,
    };
    const data = await gh("PUT", `${base}/branches/${branch}/protection`, body);
    log(
      "Applied classic protection. Status checks:",
      data.required_status_checks?.contexts || [],
      "Approvals:",
      data.required_pull_request_reviews?.required_approving_review_count || 0,
    );
  }

  async function enableClassicSignedCommits(branch) {
    const url = `${base}/branches/${branch}/protection/required_signatures`;
    const res = await fetch(url, { method: "POST", headers });
    if (res.ok) {
      log("Enabled classic required signed commits");
    } else {
      log("Failed enabling signed commits (classic)", res.status);
    }
  }

  async function disableClassicSignedCommits(branch) {
    const url = `${base}/branches/${branch}/protection/required_signatures`;
    const res = await fetch(url, { method: "DELETE", headers });
    if (res.ok || res.status === 404) {
      log("Disabled classic required signed commits (or already absent)");
    } else {
      log("Failed disabling signed commits (classic)", res.status);
    }
  }

  async function listRulesets() {
    // v1 rulesets API
    return await gh("GET", `${base}/rulesets`);
  }

  async function deleteRulesets() {
    const rs = await listRulesets();
    if (!Array.isArray(rs) || !rs.length) {
      log("No rulesets to delete");
      return;
    }
    for (const r of rs) {
      await gh("DELETE", `${base}/rulesets/${r.id}`);
      log(`Deleted ruleset ${r.name} (${r.id})`);
    }
  }

  async function createRuleset(
    branch,
    checks,
    approvals,
    { codeScanning = false, signedCommits = false } = {},
  ) {
    // Basic ruleset with status checks + approvals on default branch
    // GitHub ruleset API evolves; use minimal supported structure: each rule object must include 'type' and may include 'parameters'.
    // If schema rejects combined rules, attempt sequential creation: create status then patch in PR approvals (simplified here).
    let rules = [];
    // Attempt creation with both; if 422 fallback to only status checks.
    const statusRule = checks.length
      ? {
          type: "required_status_checks",
          parameters: {
            required_status_checks: checks.map((c) => ({ context: c })),
            strict_required_status_checks_policy: false,
            do_not_enforce_on_create: false,
          },
        }
      : null;
    const prRule =
      approvals > 0
        ? {
            type: "pull_request",
            parameters: { required_approving_review_count: approvals },
          }
        : null;
    if (statusRule) rules.push(statusRule);
    if (prRule) rules.push(prRule);
    if (codeScanning) {
      rules.push({
        type: "code_scanning",
        parameters: { required_code_scanning_alerts: 1 },
      });
    }
    if (signedCommits) {
      rules.push({ type: "signed_commits", parameters: {} });
    }
    const body = {
      name: "auto-generated-ruleset",
      target: "branch",
      enforcement: "active",
      bypass_actors: [],
      conditions: {
        ref_name: { include: [`refs/heads/${branch}`], exclude: [] },
      },
      rules,
    };
    try {
      const data = await gh("POST", `${base}/rulesets`, body);
      log("Created ruleset id", data.id, "with", body.rules.length, "rules");
    } catch (e) {
      if (/Invalid property .*rules\/1/.test(String(e)) && prRule) {
        log("PR approvals rule not accepted; retrying with only status checks");
        const fallbackRules = [statusRule].filter(Boolean);
        if (codeScanning)
          fallbackRules.push({
            type: "code_scanning",
            parameters: { required_code_scanning_alerts: 1 },
          });
        if (signedCommits)
          fallbackRules.push({ type: "signed_commits", parameters: {} });
        const fallback = { ...body, rules: fallbackRules };
        const data2 = await gh("POST", `${base}/rulesets`, fallback);
        log(
          "Created ruleset id",
          data2.id,
          "with",
          fallback.rules.length,
          "rules (fallback)",
        );
      } else {
        throw e;
      }
    }
  }

  async function getRepo() {
    return await gh("GET", base);
  }

  async function capture(output) {
    // Reuse existing capture script
    const env = Object.assign({}, process.env, { OUTPUT: output });
    execSync("node scripts/capture-fixture.js", { stdio: "inherit", env });
  }

  // Discover default branch
  const repoMeta = await getRepo();
  const defaultBranch = repoMeta.default_branch || "main";

  switch (action) {
    case "set-visibility": {
      const vis = process.env.VISIBILITY;
      await setVisibility(vis);
      break;
    }
    case "enable-auto-merge": {
      const enable = /^true$/i.test(process.env.ENABLE || "true");
      await enableAutoMerge(enable);
      break;
    }
    case "apply-classic": {
      const checks = (process.env.CHECKS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const approvals = parseInt(process.env.APPROVALS || "0", 10) || 0;
      await removeClassicProtection(defaultBranch).catch(() => {}); // ensure clean
      await deleteRulesets().catch(() => {}); // avoid rule conflicts
      await applyClassicProtection(defaultBranch, checks, approvals);
      break;
    }
    case "remove-classic": {
      await removeClassicProtection(defaultBranch);
      break;
    }
    case "apply-ruleset": {
      const checks = (process.env.CHECKS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const approvals = parseInt(process.env.APPROVALS || "0", 10) || 0;
      await removeClassicProtection(defaultBranch).catch(() => {});
      await deleteRulesets().catch(() => {});
      await createRuleset(defaultBranch, checks, approvals);
      break;
    }
    case "delete-rulesets": {
      await deleteRulesets();
      break;
    }
    case "capture-scenario": {
      const scenario = process.env.SCENARIO;
      const output = process.env.OUTPUT || `${scenario}_capture_${Date.now()}`;
      const checks = (process.env.CHECKS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const approvals = parseInt(process.env.APPROVALS || "0", 10) || 0;
      if (!scenario)
        fatal(
          "Provide SCENARIO=classic|rules|automerge|classic_rules|rules_codescan_signed|classic_signed|classic_rules_codescan_signed",
        );
      if (scenario === "classic") {
        await setVisibility("public").catch(() => {}); // attempt public for broader API behavior
        await removeClassicProtection(defaultBranch).catch(() => {});
        await deleteRulesets().catch(() => {});
        await applyClassicProtection(defaultBranch, checks, approvals);
      } else if (scenario === "classic_rules") {
        await setVisibility("public").catch(() => {});
        await removeClassicProtection(defaultBranch).catch(() => {});
        await deleteRulesets().catch(() => {});
        await applyClassicProtection(defaultBranch, checks, approvals);
        // add a ruleset (status checks only currently)
        await createRuleset(defaultBranch, checks, 0).catch(() => {});
      } else if (scenario === "rules_codescan_signed") {
        await removeClassicProtection(defaultBranch).catch(() => {});
        await deleteRulesets().catch(() => {});
        await createRuleset(defaultBranch, checks, approvals, {
          codeScanning: true,
          signedCommits: true,
        }).catch(() => {});
      } else if (scenario === "classic_signed") {
        await setVisibility("public").catch(() => {});
        await removeClassicProtection(defaultBranch).catch(() => {});
        await deleteRulesets().catch(() => {});
        await applyClassicProtection(defaultBranch, checks, approvals);
        await enableClassicSignedCommits(defaultBranch).catch(() => {});
      } else if (scenario === "classic_rules_codescan_signed") {
        await setVisibility("public").catch(() => {});
        await removeClassicProtection(defaultBranch).catch(() => {});
        await deleteRulesets().catch(() => {});
        await applyClassicProtection(defaultBranch, checks, approvals);
        await enableClassicSignedCommits(defaultBranch).catch(() => {});
        await createRuleset(defaultBranch, checks, approvals, {
          codeScanning: true,
          signedCommits: true,
        }).catch(() => {});
      } else if (scenario === "rules") {
        await removeClassicProtection(defaultBranch).catch(() => {});
        await deleteRulesets().catch(() => {});
        await createRuleset(defaultBranch, checks, approvals);
      } else if (scenario === "automerge") {
        await enableAutoMerge(true);
        // ensure at least classic protection absent and a ruleset may exist; proceed with capture directly
      } else {
        fatal("Unknown SCENARIO");
      }
      await capture(output);
      log("Scenario capture complete ->", output);
      break;
    }
    default:
      fatal(`Unknown ACTION: ${action}`);
  }
}

function log(...a) {
  console.log("[repo-admin]", ...a);
}
function fatal(msg) {
  console.error("[repo-admin] ERROR:", msg);
  process.exit(1);
}

main().catch((e) => {
  console.error("[repo-admin] Unhandled error:", e.stack || e);
  process.exit(1);
});
