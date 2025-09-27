#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const [, , version, changelogFile] = process.argv;
if (!version || !changelogFile) {
  console.error("Usage: write-changes-md.js <version> <changelogFile>");
  process.exit(1);
}

const notesPath = path.resolve(process.cwd(), "release-notes.txt");
const changesPath = path.resolve(process.cwd(), changelogFile);

const notes = fs.readFileSync(notesPath, "utf8");
const date = new Date().toISOString().split("T")[0];
let changelog = `## ${version} - ${date}\n\n${notes.trim()}\n\n`;

if (fs.existsSync(changesPath)) {
  changelog += fs.readFileSync(changesPath, "utf8");
}

fs.writeFileSync(changesPath, changelog);
console.log(`${changelogFile} updated for version ${version}`);
