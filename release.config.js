"use strict";
const { execSync } = require("child_process");

module.exports = {
    // This is the protected branch the PRs merge into
    branches: ["main"],
    repositoryUrl: execSync("git config --get remote.origin.url")
        .toString()
        .trim(),
    plugins: [
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
            {
                changelogFile: "CHANGELOG.md",
                changelogTitle: "# Changelog",
            },
        ],
        "@semantic-release/npm",
        [
            "@semantic-release/git",
            {
                assets: ["package.json", "package-lock.json", "CHANGELOG.md"],
                message:
                    "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
            },
        ],
        "@semantic-release/github",
    ],
};
