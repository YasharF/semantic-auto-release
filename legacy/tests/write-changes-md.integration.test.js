const fs = require("fs");
const path = require("path");
const sinon = require("sinon");
const { expect } = require("chai");
const { execSync } = require("child_process");

describe("(legacy) scripts/write-changes-md.js", function () {
  const notesFile = "test_notes.md";
  const changesFile = "CHANGES.md";
  const execSync = require("child_process").execSync;
  let stashed = false;
  let hadChanges = false;
  beforeEach(function () {
    if (fs.existsSync(notesFile)) fs.unlinkSync(notesFile);
    // Check if CHANGES.md has changes
    const status = execSync("git status --porcelain CHANGES.md")
      .toString()
      .trim();
    if (status) {
      execSync("git stash push CHANGES.md");
      stashed = true;
      hadChanges = true;
    } else {
      hadChanges = false;
    }
  });
  afterEach(function () {
    if (fs.existsSync(notesFile)) fs.unlinkSync(notesFile);
    // Restore CHANGES.md
    if (stashed) {
      try {
        execSync("git stash pop");
      } catch (e) {
        console.warn(
          'Warning: Could not unstash CHANGES.md automatically. Please run "git stash list" and "git stash pop" manually if needed.',
        );
      }
    } else if (!hadChanges) {
      execSync("git checkout -- CHANGES.md");
    }
  });

  it("should prepend new release notes to CHANGES.md", function () {
    fs.writeFileSync(notesFile, "Some release notes");
    execSync(
      `node scripts/write-changes-md.js 2.0.0 ${notesFile} ${changesFile}`,
    );
    const changes = fs.readFileSync(changesFile, "utf8");
    expect(changes).to.match(/## 2.0.0 - \d{4}-\d{2}-\d{2}/);
    expect(changes).to.match(/Some release notes/);
  });

  it("should preserve existing CHANGES.md content", function () {
    fs.writeFileSync(notesFile, "New notes");
    fs.writeFileSync(changesFile, "Old changelog");
    execSync(
      `node scripts/write-changes-md.js 3.0.0 ${notesFile} ${changesFile}`,
    );
    const changes = fs.readFileSync(changesFile, "utf8");
    expect(changes).to.match(/## 3.0.0 - \d{4}-\d{2}-\d{2}/);
    expect(changes).to.match(/New notes/);
    expect(changes).to.match(/Old changelog/);
  });

  it("should error if missing arguments", function () {
    const { spawnSync } = require("child_process");
    const proc = spawnSync("node", ["scripts/write-changes-md.js"], {
      encoding: "utf8",
    });
    expect(proc.stderr).to.include(
      "Usage: write-changes-md.js <version> <notesFile>",
    );
  });
});
