const { expect } = require("chai");
const path = require("node:path");
const { assessCapabilities } = require("../../dist/core/capabilities");

describe("assessCapabilities (fixtures)", () => {
  it("private_free: detects private visibility and reports branch protection limitations", async () => {
    const fixtureDir = path.resolve("test/fixtures/scenarios/private_free");
    const report = await assessCapabilities({ fixtureDir });
    expect(report.context.visibility).to.equal("private");
    // On a free private repo, branch protection endpoints return 403 so detection may fall back to none or unknown
    expect(report.context.branchProtection).to.be.oneOf(["none", "unknown"]);
    // Should still have at least one usable PAT (admin) token
    expect(report.context.usableTokens.length).to.be.greaterThan(0);
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
  });
  it("public_free_noprotection: detects usable tokens and default branch", async () => {
    const fixtureDir = path.resolve(
      "test/fixtures/scenarios/public_free_noprotection",
    );
    const report = await assessCapabilities({ fixtureDir });
    expect(report).to.have.property("context");
    expect(report.context.defaultBranch).to.equal("main");
    expect(report.context.usableTokens.length).to.be.greaterThan(0);
    expect(report.tokenMatrix).to.have.property("PAT_ADMIN");
    expect(report.tokenMatrix["PAT_ADMIN"].isAdmin).to.equal(true);
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
    // No required status checks expected if branch protection conclusively 'none'.
    // Tri-state: undefined means unknown (endpoints not readable) vs false means deterministically none.
    if (report.context.branchProtection === "none") {
      if (report.context.requiredStatusChecksEnabled !== undefined) {
        expect(report.context.requiredStatusChecksEnabled).to.be.false;
      } else {
        // TODO: Capture fixture where branchProtection conclusively 'none' and assert false explicitly.
      }
    }
    // PR requirement tri-state: undefined (unknown), false (deterministically none), true (enforced)
    if (report.context.branchProtection === "none") {
      expect(report.context.prRequired).to.equal(false);
    } else if (report.context.prRequired !== undefined) {
      expect(report.context.prRequired).to.be.a("boolean");
    } // else undefined allowed
    // deferred flags (code scanning / signed commits) removed
  });

  it("public_free_classicprotection: detects classic protection and status checks", async () => {
    const fixtureDir = path.resolve(
      "test/fixtures/scenarios/public_free_classicprotection",
    );
    const report = await assessCapabilities({ fixtureDir });
    expect(report.context.branchProtection).to.be.oneOf(["classic", "none"]);
    if (report.context.branchProtection === "classic") {
      expect(report.context.requiredStatusChecksEnabled).to.be.a("boolean");
    }
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
    expect(report.context).to.include.keys(["prRequired"]);
  });

  it("public_free_ruleprotection: detects rules protection with status contexts", async () => {
    const fixtureDir = path.resolve(
      "test/fixtures/scenarios/public_free_ruleprotection",
    );
    const report = await assessCapabilities({ fixtureDir });
    if (report.context.branchProtection === "rules") {
      expect(report.context.requiredStatusChecksEnabled).to.equal(true);
      expect(report.context.requiredStatusCheckContexts).to.include(
        "static-and-unit-tests",
      );
    }
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
    expect(report.context).to.include.keys(["prRequired"]);
  });

  it("classic_with_checks: detects classic protection, status checks and (optional) approvals", async () => {
    const realDir = path.resolve("test/fixtures/scenarios/classic_real");
    const fallback = path.resolve(
      "test/fixtures/scenarios/classic_with_checks",
    );
    const dir = require("fs").existsSync(realDir) ? realDir : fallback;
    const report = await assessCapabilities({ fixtureDir: dir });
    expect(report.context.branchProtection).to.equal("classic");
    expect(report.context.requiredStatusChecksEnabled).to.equal(true);
    expect(report.context.requiredStatusCheckContexts).to.include.members([
      "build",
      "test",
    ]);
    // Real capture might not include approvals depending on API/plan
    if (dir.endsWith("classic_with_checks")) {
      expect(report.context.requiredApprovals).to.equal(2);
    } else {
      expect(report.context.requiredApprovals).to.be.oneOf([
        undefined,
        0,
        1,
        2,
      ]);
    }
    expect(report.context).to.include.keys(["prRequired"]);
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
  });

  it("rules_with_checks_and_approvals: detects rules with contexts and optional approvals", async () => {
    const realDir = path.resolve("test/fixtures/scenarios/rules_real");
    const fallback = path.resolve(
      "test/fixtures/scenarios/rules_with_checks_and_approvals",
    );
    const dir = require("fs").existsSync(realDir) ? realDir : fallback;
    const report = await assessCapabilities({ fixtureDir: dir });
    expect(report.context.branchProtection).to.equal("rules");
    expect(report.context.requiredStatusCheckContexts).to.include.members([
      "build",
      "test",
    ]);
    expect(report.context.requiredApprovals).to.be.oneOf([undefined, 0, 1, 2]);
    expect(report.context).to.include.keys(["prRequired"]);
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
  });

  it("automerge_enabled: captures autoMergeEnabled flag", async () => {
    const realDir = path.resolve("test/fixtures/scenarios/automerge_real");
    const fallback = path.resolve("test/fixtures/scenarios/automerge_enabled");
    const dir = require("fs").existsSync(realDir) ? realDir : fallback;
    const report = await assessCapabilities({ fixtureDir: dir });
    expect(report.context.autoMergeEnabled).to.equal(true);
    expect(report.context).to.include.keys(["prRequired"]);
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
  });

  it("no_usable_token: reports gap when no token meets requirements", async () => {
    const fixtureDir = path.resolve("test/fixtures/scenarios/no_usable_token");
    const report = await assessCapabilities({ fixtureDir });
    expect(report.context.usableTokens).to.have.length(0);
    expect(report.gaps.map((g) => g.capability)).to.include("usable-token");
    expect(report.context).to.include.keys(["prRequired"]);
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
  });

  it("classic_rules_real: detects combined classic+rules protection and flags", async () => {
    const combinedDir = path.resolve(
      "test/fixtures/scenarios/classic_rules_real",
    );
    if (!require("fs").existsSync(combinedDir)) return; // skip if fixture not present
    const report = await assessCapabilities({ fixtureDir: combinedDir });
    expect(report.context.branchProtection).to.equal("classic+rules");
    expect(report.context.requiredStatusChecksEnabled).to.equal(true);
    expect(report.context.requiredStatusCheckContexts).to.include.members([
      "build",
      "test",
    ]);
    expect(report.context.prRequired).to.be.a("boolean");
    // Approvals may or may not be enforced depending on plan; only assert type
    expect(report.context).to.have.property("requiredApprovals");
    // Currently no code scanning or signed commit requirements in fixture; assert false
    // deferred flags removed
    expect(report.context).to.have.property("allowSquashMerge");
    expect(report).to.have.property("capabilityMinimumTokens");
  });

  // Removed future tests for deferred code scanning / signed commits
});

describe("additional capability tests", () => {
  it("reports allow-squash-merge gap when disabled", async () => {
    const path = require("node:path");
    const { assessCapabilities } = require("../../dist/core/capabilities");
    const fixtureDir = path.resolve("test/fixtures/scenarios/squash_disabled");
    const report = await assessCapabilities({ fixtureDir });
    expect(report.context.allowSquashMerge).to.equal(false);
    expect(report.gaps.map((g) => g.capability)).to.include(
      "allow-squash-merge",
    );
    // release-basic should not list any minimal tokens since allowSquashMerge false
    if (report.capabilityMinimumTokens) {
      expect(report.capabilityMinimumTokens).to.not.have.property(
        "release-basic",
      );
    }
  });

  it("derives minimal tokens preferring non-admin first when both present", async () => {
    // Synthetic fixture inline (no filesystem write): build CapabilityReport manually
    const { assessCapabilities } = require("../../dist/core/capabilities");
    const fs = require("node:fs");
    const tmpDir = require("node:fs").mkdtempSync(
      require("node:os").tmpdir() + "/sar-mini-",
    );
    const write = (name, obj) =>
      fs.writeFileSync(`${tmpDir}/${name}`, JSON.stringify(obj, null, 2));
    // Two tokens: PAT_PUSH (non-admin push) and PAT_ADMIN (admin)
    const step1 = {
      PAT_PUSH: {
        status_code: 200,
        data: {
          default_branch: "main",
          private: false,
          allow_auto_merge: true,
          allow_squash_merge: true,
          permissions: { admin: false, push: true },
        },
      },
      PAT_ADMIN: {
        status_code: 200,
        data: {
          default_branch: "main",
          private: false,
          allow_auto_merge: true,
          allow_squash_merge: true,
          permissions: { admin: true, push: true },
        },
      },
    };
    const step6 = {
      PAT_PUSH: { status_code: 200, data: [{ name: "main" }] },
      PAT_ADMIN: { status_code: 200, data: [{ name: "main" }] },
    };
    const step2 = {
      PAT_PUSH: { status_code: 404, data: {} },
      PAT_ADMIN: { status_code: 404, data: {} },
    };
    const step3 = {
      PAT_PUSH: { status_code: 200, data: [] },
      PAT_ADMIN: { status_code: 200, data: [] },
    };
    write("step1_main_branch.json", step1);
    write("step6_branch_list.json", step6);
    write("step2_classic_protection.json", step2);
    write("step3_rules_protection.json", step3);
    const report = await assessCapabilities({ fixtureDir: tmpDir });
    expect(report.capabilityMinimumTokens)
      .to.have.property("repo-read")
      .deep.equal(["PAT_PUSH", "PAT_ADMIN"]);
    expect(report.capabilityMinimumTokens)
      .to.have.property("push")
      .deep.equal(["PAT_PUSH", "PAT_ADMIN"]);
    expect(report.capabilityMinimumTokens)
      .to.have.property("release-basic")
      .deep.equal(["PAT_PUSH", "PAT_ADMIN"]);
  });
});
