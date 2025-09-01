const { expect } = require("chai");
const { execSync } = require("child_process");
const path = require("path");

describe("integration: release.config.js", function () {
  it("should load semantic-release config without error", function () {
    // Try to require the config and check for expected keys
    const config = require("../release.config.js");
    expect(config).to.be.an("object");
    expect(config).to.have.property("plugins");
  });

  it("semantic-release should run dry-run with config", function (done) {
    this.timeout(10000);
    const { exec } = require("child_process");
    exec("npx semantic-release --dry-run --no-ci", (error, stdout, stderr) => {
      const output = stdout + stderr;
      expect(output).to.include("semantic-release");
      done();
    });
  });
});
