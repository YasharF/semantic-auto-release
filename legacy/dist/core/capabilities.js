"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessCapabilities = assessCapabilities;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Assess repository automation capabilities from either:
 *  - recorded fixture directory (deterministic tests)
 *  - live GitHub API (best-effort minimal probing) if no fixtureDir supplied
 */
async function assessCapabilities(opts = {}) {
  if (opts.fixtureDir) {
    return assessFromFixtures(opts.fixtureDir, opts);
  }
  return assessLive(opts);
}
async function assessLive(_opts) {
  const ownerRepo =
    process.env["SAR_REPO"] ||
    process.env["GITHUB_REPOSITORY"] ||
    (process.env["REPO_OWNER"] && process.env["REPO_NAME"]
      ? `${process.env["REPO_OWNER"]}/${process.env["REPO_NAME"]}`
      : undefined); // expected format owner/repo
  if (!ownerRepo) {
    return {
      gaps: [
        {
          capability: "live-mode",
          reason: "Missing SAR_REPO env var",
          recommendation: "Set SAR_REPO=owner/repo to enable live probing.",
        },
      ],
      context: { branchProtection: "unknown", usableTokens: [] },
      tokenMatrix: {},
    };
  }
  const [owner, repo] = ownerRepo.split("/");
  const tokenEnvCandidates = Object.keys(process.env).filter((k) =>
    /(GH_TOKEN|PAT_|GITHUB_TOKEN)/.test(k),
  );
  if (!tokenEnvCandidates.length) {
    return {
      gaps: [
        {
          capability: "usable-token",
          reason: "No token env vars detected",
          recommendation:
            "Export at least GH_TOKEN or a PAT_* variable before running.",
        },
      ],
      context: { branchProtection: "unknown", usableTokens: [] },
      tokenMatrix: {},
    };
  }
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const results = [];
  const defaultBranchFallback = "main";
  // first pass: get repo meta to discover default branch
  for (const envName of tokenEnvCandidates) {
    const tokenVal = process.env[envName];
    if (!tokenVal) continue;
    const r = { tokenEnv: envName, errors: [] };
    r.repoMeta = await ghGet(base, tokenVal, envName, r.errors);
    results.push(r);
  }
  const discoveredDefault =
    results.find((r) => r.repoMeta && r.repoMeta.default_branch)?.repoMeta
      ?.default_branch || defaultBranchFallback;
  // second pass: other endpoints per token
  await Promise.all(
    results.map(async (r) => {
      const tokenVal = process.env[r.tokenEnv];
      r.branchProtection = await ghGet(
        `${base}/branches/${discoveredDefault}/protection`,
        tokenVal,
        r.tokenEnv,
        r.errors,
        true,
      );
      r.rulesProtection = await ghGet(
        `${base}/rules/branches/${discoveredDefault}`,
        tokenVal,
        r.tokenEnv,
        r.errors,
        true,
      );
      r.branchMeta = await ghGet(
        `${base}/branches/${discoveredDefault}`,
        tokenVal,
        r.tokenEnv,
        r.errors,
        true,
      );
      const headSha = r.branchMeta?.data?.commit?.sha;
      if (headSha) {
        r.commitStatus = await ghGet(
          `${base}/commits/${headSha}/status`,
          tokenVal,
          r.tokenEnv,
          r.errors,
          true,
        );
      }
      // permission endpoint requires a username; use owner as heuristic
      r.permission = await ghGet(
        `${base}/collaborators/${owner}/permission`,
        tokenVal,
        r.tokenEnv,
        r.errors,
        true,
      );
      r.branchList = await ghGet(
        `${base}/branches?per_page=100`,
        tokenVal,
        r.tokenEnv,
        r.errors,
        true,
      );
    }),
  );
  // Convert to tokenMatrix similar to fixtures logic
  const tokenMatrix = {};
  let branchProtection = "unknown";
  let requiredStatusChecksEnabled;
  let requiredStatusCheckContexts;
  let requiredApprovals;
  let defaultBranch = discoveredDefault;
  let visibility;
  let autoMergeEnabled;
  let allowSquashMerge;
  let prRequired;
  // Gather classic info (don't early break so we can also detect rules)
  let classicDetected = false;
  for (const r of results) {
    if (r.branchProtection && r.branchProtection.status_code === 200) {
      classicDetected = true;
      const cp = r.branchProtection.data;
      const required = cp?.required_status_checks;
      if (required) {
        const ctxs = (required.contexts || []).slice();
        requiredStatusCheckContexts = ctxs.length ? ctxs : [];
        requiredStatusChecksEnabled = ctxs.length > 0 ? true : false;
      }
      const pr = cp?.required_pull_request_reviews;
      if (pr) {
        requiredApprovals = pr.required_approving_review_count;
        prRequired = true;
      }
      // deferred: ignore required signatures flag
    }
  }
  // Gather rules info
  let rulesDetected = false;
  for (const r of results) {
    if (Array.isArray(r.rulesProtection?.data)) {
      const arr = r.rulesProtection.data;
      if (arr.length > 0) {
        rulesDetected = true;
        const statusRule = arr.find((x) => x.type === "required_status_checks");
        const prRule = arr.find((x) => x.type === "pull_request");
        // deferred: ignore code scanning & signed commits
        if (statusRule) {
          const ctxs =
            statusRule.parameters?.required_status_checks
              ?.map((c) => c.context)
              .filter(Boolean) || [];
          requiredStatusCheckContexts = ctxs.length ? ctxs : [];
          requiredStatusChecksEnabled = ctxs.length > 0 ? true : false;
        }
        if (prRule) {
          prRequired = true;
          if (
            prRule.parameters?.required_approving_review_count !== undefined
          ) {
            requiredApprovals =
              prRule.parameters?.required_approving_review_count;
          }
        } else {
          // Rules readable, no pull_request rule => explicitly false (not required)
          prRequired = prRequired ?? false;
        }
        // deferred
      }
    }
  }
  if (classicDetected && rulesDetected) branchProtection = "classic+rules";
  else if (classicDetected) branchProtection = "classic";
  else if (rulesDetected) branchProtection = "rules";
  else {
    const protectionCodes = results
      .map((r) => r.branchProtection?.status_code)
      .filter(Boolean);
    if (protectionCodes.length && protectionCodes.every((c) => c === 404))
      branchProtection = "none";
  }
  if (branchProtection === "none") {
    if (requiredStatusChecksEnabled === undefined)
      requiredStatusChecksEnabled = false;
    if (prRequired === undefined) prRequired = false;
    if (!requiredStatusCheckContexts) requiredStatusCheckContexts = [];
  }
  for (const r of results) {
    const repoMeta = r.repoMeta?.data || r.repoMeta; // repoMeta may wrap like fixtures; handle both
    const permissions = repoMeta?.permissions;
    if (repoMeta?.default_branch) defaultBranch = repoMeta.default_branch;
    if (repoMeta?.private !== undefined)
      visibility = repoMeta.private ? "private" : "public";
    if (repoMeta?.allow_auto_merge !== undefined)
      autoMergeEnabled = repoMeta.allow_auto_merge;
    if (repoMeta?.allow_squash_merge !== undefined)
      allowSquashMerge = repoMeta.allow_squash_merge;
    tokenMatrix[r.tokenEnv] = {
      token: r.tokenEnv,
      valid: !(r.repoMeta?.status_code === 401),
      repoRead: !!repoMeta,
      canListBranches:
        Array.isArray(r.branchList?.data) || Array.isArray(r.branchList),
      canReadBranchProtection:
        r.branchProtection?.status_code === 200 ||
        r.branchProtection?.status_code === 404,
      isAdmin: !!permissions?.admin,
      canPush: !!permissions?.push,
    };
  }
  const usableTokens = Object.values(tokenMatrix)
    .filter((t) => t.valid && t.repoRead && t.canPush && t.canListBranches)
    .map((t) => t.token);
  const gaps = [];
  if (!usableTokens.length)
    gaps.push({
      capability: "usable-token",
      reason: "No token satisfied repo read + push + list branches",
      recommendation: "Provide a PAT with repo scope",
    });
  if (allowSquashMerge === false) {
    gaps.push({
      capability: "allow-squash-merge",
      reason: 'Repository does not have "Allow squash merging" enabled',
      recommendation:
        'Enable "Allow squash merging" in Settings > General > Merge button options.',
    });
  }
  return {
    gaps,
    context: {
      branchProtection,
      defaultBranch,
      visibility,
      usableTokens,
      autoMergeEnabled,
      allowSquashMerge,
      requiredStatusChecksEnabled,
      requiredStatusCheckContexts,
      requiredApprovals,
      prRequired,
    },
    tokenMatrix,
    capabilityMinimumTokens: deriveCapabilityMinimums(tokenMatrix, {
      allowSquashMerge: allowSquashMerge !== false,
    }),
    // token role classification intentionally deferred / omitted
  };
}
async function ghGet(url, token, tokenEnv, errors, permissive = false) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "semantic-auto-release-capability",
      },
    });
    const status_code = res.status;
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore body parse errors */
    }
    return { endpoint: url, status_code, ok: res.ok, data };
  } catch (e) {
    errors.push(`${tokenEnv}:${url}:${e.message}`);
    if (permissive)
      return {
        endpoint: url,
        status_code: 0,
        ok: false,
        data: { error: e.message },
      };
    throw e;
  }
}
function assessFromFixtures(fixtureDir, opts) {
  const stepFiles = fs
    .readdirSync(fixtureDir)
    .filter((f) => f.endsWith(".json"));
  // Map token -> per step responses
  const perToken = {};
  for (const file of stepFiles) {
    const json = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, file), "utf8"),
    );
    for (const tokenName of Object.keys(json)) {
      if (json[tokenName]?.skipped) continue;
      perToken[tokenName] = perToken[tokenName] || { steps: {} };
      perToken[tokenName].steps[file] = json[tokenName];
    }
  }
  const tokenMatrix = {};
  let branchProtection = "unknown";
  let defaultBranch;
  let visibility;
  let autoMergeEnabled;
  let allowSquashMerge;
  let requiredStatusChecksEnabled;
  let requiredStatusCheckContexts;
  let requiredApprovals;
  let prRequired;
  // Determine branch protection by inspecting any *classic* protection endpoint results in step2 / step3
  const step2Name = stepFiles.find((f) =>
    f.includes("step2_classic_protection"),
  );
  const step3Name = stepFiles.find((f) => f.includes("step3_rules_protection"));
  if (step2Name) {
    const step2Json = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, step2Name), "utf8"),
    );
    const successEntry = Object.values(step2Json).find(
      (v) => v && v.status_code === 200,
    );
    const has200 = !!successEntry;
    const has404 = Object.values(step2Json).some(
      (v) => v && v.status_code === 404,
    );
    if (has200) {
      branchProtection = "classic";
      const required = successEntry.data?.required_status_checks;
      if (required) {
        const ctxs = (required.contexts || []).slice();
        requiredStatusCheckContexts = ctxs.length ? ctxs : [];
        requiredStatusChecksEnabled = ctxs.length > 0 ? true : false;
      }
      const prReviews = successEntry.data?.required_pull_request_reviews;
      if (prReviews)
        requiredApprovals = prReviews.required_approving_review_count;
      if (prReviews) prRequired = true;
      // ignore required signatures (out of scope)
    } else if (has404) branchProtection = "none";
  }
  if (branchProtection !== "classic" && step3Name) {
    // only evaluate rules if classic not detected
    const step3Json = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, step3Name), "utf8"),
    );
    // Determine if there are any rule objects of interest
    const sampleTokenData = Object.values(step3Json).find(
      (v) => v && v.status_code === 200 && Array.isArray(v.data),
    );
    if (sampleTokenData) {
      const rulesArr = sampleTokenData.data;
      const statusRule = rulesArr.find(
        (r) => r.type === "required_status_checks",
      );
      const prRule = rulesArr.find((r) => r.type === "pull_request");
      // ignore code_scanning / signed commits rules (out of scope)
      if (rulesArr.length > 0) {
        branchProtection = "rules";
        if (statusRule) {
          const ctxs =
            statusRule.parameters?.required_status_checks
              ?.map((c) => c.context)
              .filter(Boolean) || [];
          requiredStatusCheckContexts = ctxs.length ? ctxs : [];
          requiredStatusChecksEnabled = ctxs.length > 0 ? true : false;
        }
        if (prRule) {
          prRequired = true;
          if (
            prRule.parameters?.required_approving_review_count !== undefined
          ) {
            requiredApprovals =
              prRule.parameters?.required_approving_review_count;
          }
        } else {
          // Rules readable, no PR rule present
          prRequired = prRequired ?? false;
        }
        // deferred enforcement flags removed
      } else if (branchProtection === "unknown") {
        // Empty rules array only implies none if we didn't already conclude classic
        branchProtection = "none";
      }
    }
  }
  // If both were present but we first set classic, upgrade classification
  if (branchProtection === "classic" && step2Name && step3Name) {
    const hasClassic = branchProtection === "classic";
    const step3Json = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, step3Name), "utf8"),
    );
    const sampleTokenData = Object.values(step3Json).find(
      (v) =>
        v &&
        v.status_code === 200 &&
        Array.isArray(v.data) &&
        v.data.length > 0,
    );
    if (hasClassic && sampleTokenData) branchProtection = "classic+rules";
  }
  // Normalize explicit falses for deterministically absent protection (symmetry with live mode)
  if (branchProtection === "none") {
    if (requiredStatusChecksEnabled === undefined)
      requiredStatusChecksEnabled = false;
    if (prRequired === undefined) prRequired = false;
    if (!requiredStatusCheckContexts) requiredStatusCheckContexts = [];
  }
  for (const [token, info] of Object.entries(perToken)) {
    const step1 = findStep(info.steps, "step1_main_branch");
    const step6 = findStep(info.steps, "step6_branch_list");
    const step2 = findStep(info.steps, "step2_classic_protection");
    const tokenCaps = {
      token,
      valid: statusNot(step1, 401) && statusNot(step2, 401),
      repoRead: statusIs(step1, 200),
      canListBranches: statusIs(step6, 200),
      canReadBranchProtection:
        step2 && (step2.status_code === 200 || step2.status_code === 404)
          ? true
          : false,
      isAdmin: !!step1?.data?.permissions?.admin,
      canPush: !!step1?.data?.permissions?.push,
    };
    tokenMatrix[token] = tokenCaps;
    if (tokenCaps.repoRead && !defaultBranch) {
      defaultBranch = step1?.data?.default_branch;
      visibility = step1?.data?.private ? "private" : "public";
      autoMergeEnabled = step1?.data?.allow_auto_merge;
      if (step1?.data?.allow_squash_merge !== undefined)
        allowSquashMerge = step1.data.allow_squash_merge;
    }
  }
  const required = Object.assign(
    { repoRead: true, canPush: true, canListBranches: true },
    opts.required,
  );
  // Determine usable tokens (meet all required true flags and valid)
  const usableTokens = Object.values(tokenMatrix)
    .filter(
      (t) =>
        t.valid &&
        (!required.repoRead || t.repoRead) &&
        (!required.canPush || t.canPush) &&
        (!required.canListBranches || t.canListBranches),
    )
    .map((t) => t.token);
  const gaps = [];
  if (!usableTokens.length) {
    gaps.push({
      capability: "usable-token",
      reason: "No token satisfies required repo access + push rights",
      recommendation:
        "Provide a PAT with repo:status and workflow/write scopes or adjust required capabilities",
    });
  }
  // Do not emit branch-protection-detection gap (simplified scope)
  if (allowSquashMerge === false) {
    gaps.push({
      capability: "allow-squash-merge",
      reason: 'Repository does not have "Allow squash merging" enabled',
      recommendation:
        'Enable "Allow squash merging" in Settings > General > Merge button options.',
    });
  }
  return {
    gaps,
    context: {
      branchProtection,
      defaultBranch,
      visibility,
      usableTokens,
      autoMergeEnabled,
      allowSquashMerge,
      requiredStatusChecksEnabled,
      requiredStatusCheckContexts,
      requiredApprovals,
      prRequired,
      // deferred flags removed
    },
    tokenMatrix,
    capabilityMinimumTokens: deriveCapabilityMinimums(tokenMatrix, {
      allowSquashMerge: allowSquashMerge !== false,
    }),
  };
}
function findStep(steps, prefix) {
  return Object.entries(steps).find(([k]) => k.startsWith(prefix))?.[1];
}
function statusIs(obj, code) {
  return obj?.status_code === code;
}
function statusNot(obj, code) {
  return obj && obj.status_code !== code;
}
// Heuristic derivation of minimal tokens per capability
function deriveCapabilityMinimums(matrix, repoSettings) {
  const entries = Object.values(matrix);
  // Sort tokens: non-admin first (least privilege), then admin
  // Sort: non-admin first (isAdmin false), then admin tokens to provide least-privilege ordering
  const sorted = entries.sort((a, b) => Number(a.isAdmin) - Number(b.isAdmin));
  const result = {};
  const pick = (cap, predicate) => {
    const chosen = sorted.filter(predicate).map((t) => t.token);
    if (chosen.length) result[cap] = chosen;
  };
  pick("repo-read", (t) => t.repoRead);
  pick("branch-list", (t) => t.canListBranches);
  pick("push", (t) => t.canPush);
  pick(
    "branch-protection-read",
    (t) => t.canReadBranchProtection || (t.repoRead && t.isAdmin),
  );
  pick(
    "release-basic",
    (t) =>
      t.repoRead &&
      t.canListBranches &&
      t.canPush &&
      repoSettings.allowSquashMerge,
  );
  return result;
}
// token role classification removed for now
