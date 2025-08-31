#!/usr/bin/env node
const fs = require("fs");

const [, , version, notesFile] = process.argv;
if (!version || !notesFile) {
  console.error("Usage: write-changes-md.js <version> <notesFile>");
  process.exit(1);
}

const notes = fs.readFileSync(notesFile, "utf8");
const date = new Date().toISOString().split("T")[0];
let changelog = `## ${version} - ${date}\n\n${notes.trim()}\n\n`;

if (fs.existsSync("CHANGES.md")) {
  changelog += fs.readFileSync("CHANGES.md", "utf8");
}

fs.writeFileSync("CHANGES.md", changelog);
console.log(`CHANGES.md updated for version ${version}`);
