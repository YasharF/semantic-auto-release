const { expect } = require("chai");
const { assessCapabilities } = require("../../dist/core/capabilities");

// This test hits live GitHub endpoints. It is skipped unless CAPABILITIES_LIVE=1 and a token is available.
const liveEnabled = process.env.CAPABILITIES_LIVE === "1";
const hasToken = Object.keys(process.env).some(
  (k) => /(GH_TOKEN|PAT_)/.test(k) && process.env[k],
);

(liveEnabled && hasToken ? describe : describe.skip)(
  "live: assessCapabilities",
  () => {
    it("returns a capability report for the target repo", async () => {
      const repo = process.env.SAR_REPO || process.env.GITHUB_REPOSITORY;
      if (!repo) return; // defensive; suite skipped anyway
      const report = await assessCapabilities({ repo });
      expect(report).to.have.property("context");
      expect(report.context).to.have.property("branchProtection");
      expect(report.context).to.have.property("usableTokens");
      // At least one token should be usable if provided
      expect(report.context.usableTokens).to.be.an("array");
    }).timeout(15000);
  },
);
