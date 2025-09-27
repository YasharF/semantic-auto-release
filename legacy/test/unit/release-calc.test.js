const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { calculateRelease } = require("../../dist/core/release-calc");

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "pipe" });
}

function initRepo({ initialTag = "v1.0.0", commits = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sar-test-"));
  run("git init -b main", dir);
  run('git config user.name "Test User"', dir);
  run('git config user.email "test@example.com"', dir);
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "testpkg",
        version: "0.0.0",
        repository: { type: "git", url: `file://${dir}` },
      },
      null,
      2,
    ),
  );
  run("git add package.json", dir);
  run('git commit -m "chore: initial"', dir);
  if (initialTag) run(`git tag ${initialTag}`, dir);
  for (const message of commits) {
    fs.writeFileSync(path.join(dir, "file.txt"), Math.random().toString());
    run("git add .", dir);
    run(`git commit -m "${message}"`, dir);
  }
  return dir;
}

describe("calculateRelease semantic-release dry-run", function () {
  this.timeout(20000);

  it("returns noRelease when no conventional commits beyond tag", async () => {
    const repo = initRepo({ commits: [] });
    const r = await calculateRelease({ cwd: repo });
    expect(r.noRelease).to.equal(true);
    expect(r.version).to.equal(undefined);
  });

  it("patch bump for fix commit", async () => {
    const repo = initRepo({ commits: ["fix: patch issue"] });
    const r = await calculateRelease({ cwd: repo });
    expect(r.version).to.equal("1.0.1");
  });

  it("minor bump for feat commit", async () => {
    const repo = initRepo({ commits: ["feat: add feature"] });
    const r = await calculateRelease({ cwd: repo });
    expect(r.version).to.equal("1.1.0");
  });

  it("major bump for BREAKING CHANGE footer", async () => {
    const dir = initRepo({ commits: [] });
    fs.writeFileSync(path.join(dir, "a.txt"), "1");
    run("git add a.txt", dir);
    run(
      'git commit -m "feat: something\n\nBREAKING CHANGE: new contract"',
      dir,
    );
    const r = await calculateRelease({ cwd: dir });
    expect(r.version).to.equal("2.0.0");
  });
});
