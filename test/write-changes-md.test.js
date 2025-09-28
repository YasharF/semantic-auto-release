const fs = require("fs");
const os = require("os");
const path = require("path");
const { expect } = require("chai");
const { spawnSync } = require("child_process");

const SCRIPT_PATH = path.resolve(__dirname, "../scripts/write-changes-md.js");

function runScript(args, options = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    ...options,
  });
}

describe("scripts/write-changes-md.js", function () {
  function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "write-changes-md-test-"));
  }

  afterEach(function () {
    // Clean up temp directories created by tests
    if (this.tmpDir && fs.existsSync(this.tmpDir)) {
      fs.rmSync(this.tmpDir, { recursive: true, force: true });
      this.tmpDir = undefined;
    }
  });

  it("prepends release notes to existing changelog", function () {
    const tmpDir = createTempDir();
    this.tmpDir = tmpDir;

    fs.writeFileSync(
      path.join(tmpDir, "release-notes.txt"),
      "New features\n- Added thing\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "CHANGES.md"),
      "## 1.0.0 - 2024-01-01\n\nInitial release\n",
    );

    const result = runScript(["2.0.0", "CHANGES.md"], { cwd: tmpDir });
    expect(result.status).to.equal(0);

    const changelog = fs.readFileSync(path.join(tmpDir, "CHANGES.md"), "utf8");
    const [header] = changelog.split("\n\n", 1);
    expect(header).to.match(/^## 2\.0\.0 - \d{4}-\d{2}-\d{2}$/);
    expect(changelog).to.include("New features");
    expect(changelog).to.include("## 1.0.0 - 2024-01-01");
  });

  it("creates changelog when one does not exist", function () {
    const tmpDir = createTempDir();
    this.tmpDir = tmpDir;

    fs.writeFileSync(
      path.join(tmpDir, "release-notes.txt"),
      "Bug fixes\n- Patched issue\n",
    );

    const result = runScript(["1.1.0", "CHANGES.md"], { cwd: tmpDir });
    expect(result.status).to.equal(0);

    const changelog = fs.readFileSync(path.join(tmpDir, "CHANGES.md"), "utf8");
    expect(changelog).to.match(/^## 1\.1\.0 - \d{4}-\d{2}-\d{2}/);
    expect(changelog).to.include("Bug fixes");
  });

  it("exits with error when required arguments are missing", function () {
    const tmpDir = createTempDir();
    this.tmpDir = tmpDir;

    const result = runScript([], { cwd: tmpDir });
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      "Usage: write-changes-md.js <version> <changelogFile>",
    );
  });
});
