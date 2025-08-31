"use strict";
const { execSync } = require("child_process");

const step = process.env.release_step;

const basePlugins = [
  ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
  "@semantic-release/release-notes-generator",
];

if (step === "create_release_files") {
  basePlugins.push("./plugins/export-data.js");
}

module.exports = {
  tagFormat: "v${version}",
  repositoryUrl: execSync("git config --get remote.origin.url")
    .toString()
    .trim(),
  plugins: basePlugins,
};
