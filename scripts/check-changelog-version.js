#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const [, , version, changelogArg] = process.argv;

if (!version) {
  console.error("Usage: check-changelog-version.js <version> <changelogFile>");
  process.exit(1);
}

if (!changelogArg) {
  console.error("Usage: check-changelog-version.js <version> <changelogFile>");
  process.exit(1);
}

const changelogFile = path.resolve(process.cwd(), changelogArg);

if (!fs.existsSync(changelogFile)) {
  process.exit(0);
}

const content = fs.readFileSync(changelogFile, "utf8");
const escapedVersion = escapeRegExp(version);
const patterns = [
  new RegExp(`^## ${escapedVersion}\\b`, "m"),
  new RegExp(`^# \\[${escapedVersion}\\]`, "m"),
];

if (patterns.some((pattern) => pattern.test(content))) {
  console.error(
    `Changelog ${changelogFile} already contains an entry for version ${version}.`,
  );
  process.exit(2);
}

process.exit(0);
