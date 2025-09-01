const { expect } = require("chai");
const { spawnSync } = require("child_process");
const path = require("path");

describe("integration: scripts/run-release.sh", function () {
  this.timeout(10000);
  it("should distinguish between missing semantic-release CLI and semantic-release errors", function () {
    const env = {
      ...process.env,
      DRY_RUN: "true",
      CHANGELOG_FILE: "CHANGES.md",
      RUN_PRETTIER_ON_CHANGELOG: "false",
      NPM_TOKEN: "dummy",
      GITHUB_RUN_ID: "test",
      GITHUB_RUN_NUMBER: "1",
    };
    const proc = spawnSync("bash", ["scripts/run-release.sh"], {
      env,
      encoding: "utf8",
    });
    const output = proc.stdout + proc.stderr;
    let failed = false;
    try {
      if (
        proc.status === 127 ||
        /command not found|npx: command not found|bash: semantic-release: command not found/i.test(
          output,
        )
      ) {
        // semantic-release CLI is missing
        expect(output).to.match(
          /command not found|npx: command not found|bash: semantic-release: command not found/i,
        );
        expect(proc.status).to.equal(127);
      } else {
        // semantic-release CLI is present, check for semantic-release logs or errors
        expect([0, 1]).to.include(proc.status);
        expect(output).to.match(/semantic-release/i);
        // Check that all four plugins are loaded
        expect(output).to.match(
          /Loaded plugin "verifyConditions" from \"\.\/plugins\/export-data\.js\"/,
        );
        expect(output).to.match(
          /Loaded plugin "analyzeCommits" from \"@semantic-release\/commit-analyzer\"/,
        );
        expect(output).to.match(
          /Loaded plugin "generateNotes" from \"@semantic-release\/release-notes-generator\"/,
        );
        expect(output).to.match(
          /Loaded plugin "generateNotes" from \"\.\/plugins\/export-data\.js\"/,
        );
      }
    } catch (err) {
      failed = true;
      // Print the output for visibility/debugging only if the test failed
      console.log("run-release.sh output (test failed):\n", output);
      throw err;
    }
  });
});
