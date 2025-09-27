const { assessCapabilities } = require("../dist/core/capabilities");
const fs = require("fs");
const path = require("path");

async function main() {
  const base = path.resolve("test/fixtures/scenarios");
  const entries = fs
    .readdirSync(base)
    .filter((d) => fs.lstatSync(path.join(base, d)).isDirectory());
  const results = [];
  for (const dirName of entries) {
    try {
      const dir = path.join(base, dirName);
      const report = await assessCapabilities({ fixtureDir: dir });
      const tokenReadability = Object.values(report.tokenMatrix).map((t) => ({
        token: t.token,
        canReadBranchProtection: t.canReadBranchProtection,
        isAdmin: t.isAdmin,
      }));
      results.push({
        scenario: dirName,
        branchProtection: report.context.branchProtection,
        requiredStatusChecksEnabled: report.context.requiredStatusChecksEnabled,
        prRequired: report.context.prRequired,
        requiredStatusCheckContexts: report.context.requiredStatusCheckContexts,
        tokenReadability,
      });
    } catch (e) {
      results.push({ scenario: dirName, error: e.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
