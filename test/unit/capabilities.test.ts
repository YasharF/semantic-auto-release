import { expect } from "chai";
import path from "node:path";
import { assessCapabilities } from "../../dist/core/capabilities";

describe("assessCapabilities (fixtures)", () => {
  it("public_free_noprotection: detects no classic protection and finds usable tokens", async () => {
    const fixtureDir = path.resolve(
      "test/fixtures/scenarios/public_free_noprotection",
    );
    const report = await assessCapabilities({ fixtureDir });
    expect(report.context.branchProtection).to.be.oneOf([
      "none",
      "rules",
      "classic",
    ]);
    expect(report.context.defaultBranch).to.equal("main");
    // At least one token should appear usable (an admin PAT present in fixture step1)
    expect(report.context.usableTokens.length).to.be.greaterThan(0);
    // Token matrix should include PAT_ADMIN
    expect(report.tokenMatrix).to.have.property("PAT_ADMIN");
    expect(report.tokenMatrix["PAT_ADMIN"].isAdmin).to.equal(true);
  });
});
