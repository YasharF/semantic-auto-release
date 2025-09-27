const fs = require("fs");
const path = require("path");
const sinon = require("sinon");
const { expect } = require("chai");
const { execSync, spawnSync } = require("child_process");

describe("scripts/update-packagejson-ver.js", function () {
  const pkgFile = path.resolve("package.json");
  const lockFile = path.resolve("package-lock.json");
  let pkgBackup, lockBackup;

  before(function () {
    pkgBackup = fs.readFileSync(pkgFile, "utf8");
    lockBackup = fs.existsSync(lockFile)
      ? fs.readFileSync(lockFile, "utf8")
      : null;
  });
  after(function () {
    fs.writeFileSync(pkgFile, pkgBackup);
    if (lockBackup) fs.writeFileSync(lockFile, lockBackup);
  });

  it("should update package.json and package-lock.json version", function () {
    execSync("node scripts/update-packagejson-ver.js 9.9.9");
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
    expect(pkg.version).to.equal("9.9.9");
    if (fs.existsSync(lockFile)) {
      const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      expect(lock.version).to.equal("9.9.9");
    }
  });

  it("should error if no version is provided", function () {
    const proc = spawnSync("node", ["scripts/update-packagejson-ver.js"], {
      encoding: "utf8",
    });
    expect(proc.stderr).to.include(
      "Usage: update-packagejson-ver.js <version>",
    );
  });
});
