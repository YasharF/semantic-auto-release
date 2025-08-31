"use strict";
const { execSync } = require("child_process");

const phase = process.env.PHASE || "PUBLISH"; // BUMP or PUBLISH

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
      parserOpts: { noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"] },
    },
  ],
  "@semantic-release/release-notes-generator",
];

if (phase === "BUMP") {
  basePlugins.push(
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
  );
} else if (phase === "PUBLISH") {
  basePlugins.push("@semantic-release/npm", "@semantic-release/github");
}

module.exports = {
  // Always set to main so bump mode works even if checked out on bump branch
  branches: ["main"],
  repositoryUrl: execSync("git config --get remote.origin.url")
    .toString()
    .trim(),
  plugins: basePlugins,
};
