const { expect } = require("chai");
const { spawnSync, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("integration: plugins/export-data.js with semantic-release", function () {
  this.timeout(30000);

  let tempDir;
  let versionFile;
  let notesFile;
  let branchFile;
  let originalBranch;

  before(function () {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-data-test-"));

    // Remember the branch we started on so we can restore it later
    originalBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();

    // Ensure we have an up-to-date local main tracking origin/main
    execSync("git fetch origin main --tags --prune", { stdio: "inherit" });

    // If we're currently on main in the primary worktree, detach it so we can reuse main
    if (originalBranch === "main") {
      execSync("git checkout --detach", { stdio: "inherit" });
    }

    // Create or reset local main to match origin/main
    try {
      execSync("git show-ref --verify --quiet refs/heads/main");
      execSync("git branch -f main origin/main", { stdio: "inherit" });
    } catch {
      execSync("git branch main origin/main", { stdio: "inherit" });
    }

    // Add the worktree from main
    execSync(`git worktree add --force "${tempDir}" main`, {
      stdio: "inherit",
    });

    versionFile = path.join(tempDir, "version.txt");
    notesFile = path.join(tempDir, "notes.md");
    branchFile = path.join(tempDir, "branch.txt");
  });

  after(function () {
    try {
      execSync(`git worktree remove --force "${tempDir}"`, {
        stdio: "inherit",
      });
    } catch (err) {
      console.warn(`Warning: failed to remove worktree ${tempDir}`, err);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Restore the original branch if we detached
    if (originalBranch && originalBranch !== "HEAD") {
      execSync(`git checkout ${originalBranch}`, { stdio: "inherit" });
    }
  });

  it("should export release data files when run via semantic-release", function () {
    const env = {
      ...process.env,
      // Strip CI-provided branch context so semantic-release uses the worktree branch
      GITHUB_REF: undefined,
      GITHUB_HEAD_REF: undefined,
      GITHUB_BASE_REF: undefined,
      GITHUB_EVENT_NAME: undefined,
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      NODE_PATH: path.join(process.cwd(), "node_modules"),
      DRY_RUN: "true",
      CHANGELOG_FILE: "CHANGES.md",
      RUN_PRETTIER_ON_CHANGELOG: "false",
      NPM_TOKEN: "dummy",
      GITHUB_RUN_ID: "test",
      GITHUB_RUN_NUMBER: "1",
      release_step: "create_release_files",
    };
    const proc = spawnSync(
      "npx",
      [
        "semantic-release",
        "--no-ci",
        "--dry-run",
        "--extends",
        "./release.config.js",
      ],
      {
        cwd: tempDir,
        env,
        encoding: "utf8",
      },
    );
    const output = proc.stdout + proc.stderr;
    try {
      if (
        /semantic-release-export-data: new-release-published=false/.test(output)
      ) {
        expect(output).to.match(
          /semantic-release-export-data: new-release-published=false/,
        );
      } else {
        expect(output).to.match(
          /semantic-release-export-data: new-release-published=true/,
        );
        expect(output).to.match(
          /semantic-release-export-data: new-release-version=/,
        );
        expect(output).to.match(
          /semantic-release-export-data: new-release-notes=/,
        );
        expect(output).to.match(/semantic-release-export-data: branch-name=/);
        expect(fs.existsSync(versionFile)).to.be.true;
        expect(fs.existsSync(notesFile)).to.be.true;
        expect(fs.existsSync(branchFile)).to.be.true;
        expect(fs.readFileSync(versionFile, "utf8")).to.not.be.empty;
        expect(fs.readFileSync(notesFile, "utf8")).to.not.be.empty;
        expect(fs.readFileSync(branchFile, "utf8")).to.not.be.empty;
      }
    } catch (err) {
      console.log("semantic-release output (test failed):\n", output);
      throw err;
    }
  });
});
