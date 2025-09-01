const { expect } = require("chai");
const { execSync } = require("child_process");
const path = require("path");

describe("integration: commitlint.config.js", function () {
  this.timeout(10000); // Increase timeout for slow npx

  it("should load commitlint config without error", function () {
    const config = require("../commitlint.config.js");
    expect(config).to.be.an("object");
    expect(config).to.have.property("extends");
  });

  it("commitlint should enforce rules on sample commit", async function () {
    const { exec } = require("child_process");
    // Valid commit
    await new Promise((resolve, reject) => {
      exec(
        'echo "feat: add something" | npx commitlint --config commitlint.config.js',
        (error, stdout, stderr) => {
          if (error) return reject(error);
          expect(stdout).to.equal("");
          resolve();
        },
      );
    });
    // Invalid commit
    await new Promise((resolve) => {
      exec(
        'echo "bad commit message" | npx commitlint --config commitlint.config.js',
        (error, stdout, stderr) => {
          expect(error).to.not.be.null;
          expect(stdout + stderr).to.match(
            /type may not be empty|header may not be empty|subject may not be empty/i,
          );
          resolve();
        },
      );
    });
  });
});
