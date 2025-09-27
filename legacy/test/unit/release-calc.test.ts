const { expect } = require("chai");
const { calculateRelease } = require("../../dist/core/release-calc");

describe("release-calc (placeholder)", () => {
  it("returns placeholder structure", async () => {
    const r = await calculateRelease();
    expect(r).to.have.keys(["version", "notes", "defaultBranch", "baseCommit"]);
  });
});
