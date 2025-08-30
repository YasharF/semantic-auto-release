"use strict";
const { execSync } = require("child_process");

const phase = process.env.PHASE || "PUBLISH"; // BUMP or PUBLISH
const srBranch = process.env.SR_BRANCH || "main";

const basePlugins = [
  [
    "@semantic-release/commit-analyzer",
    {
      preset: "conventionalcommits",
      releaseRules: [
        { type: "feat", release: "minor" },
        { type: "fix", release: "patch" },
        { type: "perf", release: "patch" },
        { type: "refactor", release: "patch" },
        { type: "build", release: "patch" },
        { type: "ci", release: "patch" },
        { type: "docs", release: "patch" },
        { type: "style", release: "patch" },
        { type: "test", release: "patch" },
        { type: "chore", release: false },
      ],
      parserOpts: {
        noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"],
      },
    },
  ],
  "@semantic-release/release-notes-generator",
  [
    "@semantic-release/changelog",
    { changelogFile: "CHANGES.md", changelogTitle: "# Changes" },
  ],
  [
    "@semantic-release/git",
    {
      assets: ["package.json", "package-lock.json", "CHANGES.md"],
      message:
        "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
    },
  ],
];

const publishPlugins =
  phase === "PUBLISH"
    ? ["@semantic-release/npm", "@semantic-release/github"]
    : [];

module.exports = {
  branches: [srBranch],
  repositoryUrl: execSync("git config --get remote.origin.url")
    .toString()
    .trim(),
  plugins: [...basePlugins, ...publishPlugins],
};
