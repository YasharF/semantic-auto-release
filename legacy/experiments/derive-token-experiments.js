#!/usr/bin/env node
/**
 * Derive token experiment matrix directly from raw fixture JSON (no reliance on implementation code).
 * For each scenario + token, we collect raw endpoint results and compute Y/N/U classifications.
 *
 * Endpoints (files):
 *  - repo metadata: *main_branch.json (represents GET /repos/{owner}/{repo})
 *  - classic protection: *classic_protection.json (GET /repos/{o}/{r}/branches/{branch}/protection)
 *  - rules protection: *rules_protection.json (GET /repos/{o}/{r}/rules/branches/{branch})
 */
const fs = require("fs");
const path = require("path");

const scenariosDir = path.resolve("test/fixtures/scenarios");

function loadScenario(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const tokens = new Set();
  const fileJson = {};
  for (const f of files) {
    const full = path.join(dir, f);
    const json = JSON.parse(fs.readFileSync(full, "utf8"));
    fileJson[f] = json;
    Object.keys(json).forEach((t) => {
      if (!json[t].skipped) tokens.add(t);
    });
  }
  return { files: fileJson, tokens: Array.from(tokens) };
}

function pickFile(files, substring) {
  return Object.keys(files).find((f) => f.includes(substring));
}

function derivePerToken(raw, token) {
  const repoFileName = pickFile(raw.files, "main_branch");
  const classicFileName = pickFile(raw.files, "classic_protection");
  const rulesFileName = pickFile(raw.files, "rules_protection");
  const repoEntry = repoFileName && raw.files[repoFileName][token];
  const classicEntry = classicFileName && raw.files[classicFileName][token];
  const rulesEntry = rulesFileName && raw.files[rulesFileName][token];

  const repoStatus = repoEntry?.status_code;
  const classicStatus = classicEntry?.status_code;
  const rulesStatus = rulesEntry?.status_code;
  const classicMsg = classicEntry?.data?.message;
  const rulesData = Array.isArray(rulesEntry?.data)
    ? rulesEntry.data
    : undefined;
  const rulesTypes = rulesData ? rulesData.map((r) => r.type) : undefined;
  const classicStatusChecks = classicEntry?.data?.required_status_checks;
  const classicCtxs = classicStatusChecks?.contexts || [];
  const classicReviews = classicEntry?.data?.required_pull_request_reviews;
  const rulesStatusRule = rulesData?.find(
    (r) => r.type === "required_status_checks",
  );
  const rulesStatusRuleCtxs =
    rulesStatusRule?.parameters?.required_status_checks
      ?.map((c) => c.context)
      .filter(Boolean) || [];
  const rulesPrRule = rulesData?.find((r) => r.type === "pull_request");

  // Primitive states
  const classicState =
    classicStatus === 200
      ? "present"
      : classicStatus === 404
        ? "absent"
        : !classicStatus && classicStatus !== 0
          ? "unreadable"
          : classicStatus === 401 || classicStatus === 403
            ? "unreadable"
            : "unreadable";
  const rulesState =
    rulesStatus === 200 && rulesData && rulesData.length > 0
      ? "present"
      : rulesStatus === 200 && rulesData && rulesData.length === 0
        ? "absent"
        : rulesStatus === 404
          ? "absent"
          : !rulesStatus && rulesStatus !== 0
            ? "unreadable"
            : rulesStatus === 401 || rulesStatus === 403
              ? "unreadable"
              : "unreadable";

  // Combined protection classification
  let combinedProtection;
  if (classicState === "present" && rulesState === "present")
    combinedProtection = "classic+rules";
  else if (classicState === "present") combinedProtection = "classic";
  else if (rulesState === "present") combinedProtection = "rules";
  else if (classicState === "absent" && rulesState === "absent")
    combinedProtection = "none";
  else combinedProtection = "unknown";

  // Collapse to Y/N/U indicating "any protection present"
  let branchProtection;
  if (["classic", "rules", "classic+rules"].includes(combinedProtection))
    branchProtection = "Y";
  else if (combinedProtection === "none") branchProtection = "N";
  else branchProtection = "U";

  // requiredStatusChecksEnabled
  let requiredStatusChecksEnabled; // Y/N/U
  const anyCtxs =
    (classicCtxs && classicCtxs.length > 0) ||
    (rulesStatusRuleCtxs && rulesStatusRuleCtxs.length > 0);
  const readableProtection = combinedProtection !== "unknown";
  if (!readableProtection) requiredStatusChecksEnabled = "U";
  else if (anyCtxs) requiredStatusChecksEnabled = "Y";
  else requiredStatusChecksEnabled = "N";

  // requiredStatusCheckContexts
  let requiredStatusCheckContexts;
  if (requiredStatusChecksEnabled === "U") requiredStatusCheckContexts = "U";
  else if (anyCtxs) requiredStatusCheckContexts = "Y";
  else requiredStatusCheckContexts = "N";

  // prRequired
  let prRequired;
  const prFound = !!classicReviews || !!rulesPrRule;
  if (!readableProtection) prRequired = "U";
  else if (prFound) prRequired = "Y";
  else prRequired = "N";

  // defaultBranch & visibility (Y if readable, else U)
  const defaultBranch =
    repoStatus === 200 && repoEntry?.data?.default_branch ? "Y" : "U";
  const visibility = repoStatus === 200 ? "Y" : "U";

  // autoMergeEnabled / allowSquashMerge
  function triFlag(flagName) {
    if (repoStatus !== 200) return "U";
    const val = repoEntry?.data?.[flagName];
    if (val === true) return "Y";
    if (val === false) return "N";
    return "U";
  }
  const autoMergeEnabled = triFlag("allow_auto_merge");
  const allowSquashMerge = triFlag("allow_squash_merge");

  return {
    token,
    repoStatus,
    classicStatus,
    classicMsg,
    rulesStatus,
    rulesTypes,
    classicCtxCount: classicCtxs.length,
    rulesCtxCount: rulesStatusRuleCtxs.length,
    classicHasReviews: !!classicReviews,
    rulesHasPrRule: !!rulesPrRule,
    classicState,
    rulesState,
    combinedProtection,
    branchProtection,
    requiredStatusChecksEnabled,
    requiredStatusCheckContexts,
    prRequired,
    defaultBranch,
    visibility,
    autoMergeEnabled,
    allowSquashMerge,
  };
}

function main() {
  const scenarios = fs
    .readdirSync(scenariosDir)
    .filter((d) => fs.lstatSync(path.join(scenariosDir, d)).isDirectory());
  const rows = [];
  for (const scen of scenarios) {
    const raw = loadScenario(path.join(scenariosDir, scen));
    for (const token of raw.tokens) {
      rows.push({ scenario: scen, ...derivePerToken(raw, token) });
    }
  }

  // Build markdown
  const header = [
    "Scenario",
    "Token",
    "classicState",
    "rulesState",
    "combinedProtection",
    "branchProtectionYN",
    "reqStatusChecks",
    "statusCtxs",
    "prRequired",
    "defaultBranch",
    "visibility",
    "autoMerge",
    "allowSquash",
  ];
  const lines = [
    "| " + header.join(" | ") + " |",
    "| " + header.map(() => "---").join(" | ") + " |",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.scenario} | ${r.token} | ${r.classicState} | ${r.rulesState} | ${r.combinedProtection} | ${r.branchProtection} | ${r.requiredStatusChecksEnabled} | ${r.requiredStatusCheckContexts} | ${r.prRequired} | ${r.defaultBranch} | ${r.visibility} | ${r.autoMergeEnabled} | ${r.allowSquashMerge} |`,
    );
  }

  const evidenceHeader = [
    "Scenario",
    "Token",
    "repoStatus",
    "classicStatus",
    "classicMsgSnippet",
    "rulesStatus",
    "rulesTypes",
    "classicCtxCount",
    "rulesCtxCount",
    "classicHasReviews",
    "rulesHasPrRule",
  ];
  const evLines = [
    "\n\n### Raw Evidence per Token\n",
    "| " + evidenceHeader.join(" | ") + " |",
    "| " + evidenceHeader.map(() => "---").join(" | ") + " |",
  ];
  for (const r of rows) {
    const msg = r.classicMsg
      ? r.classicMsg.slice(0, 40).replace(/\|/g, "/")
      : "";
    evLines.push(
      `| ${r.scenario} | ${r.token} | ${r.repoStatus ?? ""} | ${r.classicStatus ?? ""} | ${msg} | ${r.rulesStatus ?? ""} | ${(r.rulesTypes || []).join(",")} | ${r.classicCtxCount} | ${r.rulesCtxCount} | ${r.classicHasReviews} | ${r.rulesHasPrRule} |`,
    );
  }

  const legend = `### Legend\n- Y: evidence indicates positive / present\n- N: evidence indicates definitively absent\n- U: insufficient evidence (unreadable / inaccessible)\n\nHeuristic: classic 403 with message 'Resource not accessible by integration' + no contrary rules data => treat as N (plan unavailability).`;

  console.log("### Derived Matrix (Per Scenario / Token)");
  console.log(legend + "\n");
  console.log(lines.join("\n"));
  console.log(evLines.join("\n"));
}

main();
