#!/usr/bin/env node
const fs = require("fs");

const version = process.argv[2];
if (!version) {
  console.error("Usage: update-version.js <version>");
  process.exit(1);
}

const pkgPath = "./package.json";
const lockPath = "./package-lock.json";

// Update package.json
const pkg = require(pkgPath);
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// Update package-lock.json if it exists
if (fs.existsSync(lockPath)) {
  const lock = require(lockPath);
  lock.version = version;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
}

console.log(`Updated package.json and package-lock.json to version ${version}`);
