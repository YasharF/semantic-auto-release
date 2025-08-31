#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const [, , version, notesFile] = process.argv;
if (!version || !notesFile) {
  console.error("Usage: write-changes-md.js <version> <notesFile>");
  process.exit(1);
}

const notesPath = path.resolve(process.cwd(), notesFile);
const changesPath = path.resolve(process.cwd(), "CHANGES.md");

const notes = fs.readFileSync(notesPath, "utf8");
const date = new Date().toISOString().split("T")[0];
let changelog = `## ${version} - ${date}\n\n${notes.trim()}\n\n`;

if (fs.existsSync(changesPath)) {
  changelog += fs.readFileSync(changesPath, "utf8");
}

fs.writeFileSync(changesPath, changelog);
console.log(`CHANGES.md updated for version ${version}`);
