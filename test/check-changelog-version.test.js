const fs = require("fs");
const os = require("os");
const path = require("path");
const { expect } = require("chai");
const { spawnSync } = require("child_process");

const SCRIPT_PATH = path.join(
  __dirname,
  "..",
  "scripts",
  "check-changelog-version.js",
);

describe("check-changelog-version", function () {
  it("exits with code 2 when version heading is present", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-"));
    const changelog = path.join(dir, "CHANGES.md");
    fs.writeFileSync(
      changelog,
      "## 1.2.3 - 2024-01-01\n\n# [1.2.3](link)\n",
      "utf8",
    );

    const result = spawnSync("node", [SCRIPT_PATH, "1.2.3", changelog], {
      encoding: "utf8",
    });

    expect(result.status).to.equal(2);
    expect(result.stderr).to.include(
      "already contains an entry for version 1.2.3",
    );
  });

  it("exits with code 0 when version heading is absent", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-"));
    const changelog = path.join(dir, "CHANGES.md");
    fs.writeFileSync(changelog, "## 2.0.0 - 2024-01-01\n", "utf8");

    const result = spawnSync("node", [SCRIPT_PATH, "1.2.3", changelog], {
      encoding: "utf8",
    });

    expect(result.status).to.equal(0);
    expect(result.stderr).to.equal("");
  });

  it("exits with code 0 when changelog file is missing", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-"));
    const changelog = path.join(dir, "missing.md");

    const result = spawnSync("node", [SCRIPT_PATH, "1.2.3", changelog], {
      encoding: "utf8",
    });

    expect(result.status).to.equal(0);
  });

  it("detects version when only bracket heading is present", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-"));
    const changelog = path.join(dir, "CHANGES.md");
    fs.writeFileSync(
      changelog,
      "# [3.4.5](https://example.com/compare/v3.4.4...v3.4.5)\n",
      "utf8",
    );

    const result = spawnSync("node", [SCRIPT_PATH, "3.4.5", changelog], {
      encoding: "utf8",
    });

    expect(result.status).to.equal(2);
    expect(result.stderr).to.include("CHANGES.md");
  });

  it("exits with code 1 when version argument is missing", function () {
    const result = spawnSync("node", [SCRIPT_PATH], { encoding: "utf8" });

    expect(result.status).to.equal(1);
    expect(result.stderr).to.include("Usage:");
  });

  it("exits with code 1 when changelog file is not provided", function () {
    const result = spawnSync("node", [SCRIPT_PATH, "1.2.3"], {
      encoding: "utf8",
      env: { ...process.env, CHANGELOG_FILE: "IGNORED.md" },
    });

    expect(result.status).to.equal(1);
    expect(result.stderr).to.include(
      "Usage: check-changelog-version.js <version> <changelogFile>",
    );
  });
});
