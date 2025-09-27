#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const release_calc_1 = require("../core/release-calc");
const content_update_1 = require("../core/content-update");
const publish_1 = require("../core/publish");
async function main() {
  const calc = await (0, release_calc_1.calculateRelease)();
  await (0, content_update_1.applyContentUpdate)({
    version: calc.version,
    notes: calc.notes,
    changelogFile: process.env.CHANGELOG_FILE || "CHANGELOG.md",
  });
  if (calc.noRelease) {
    console.log("[sar] no release required");
    return;
  }
  await (0, publish_1.publishArtifacts)(calc.version, calc.notes);
  console.log(
    `[sar] release flow completed (placeholder) version=${calc.version}`,
  );
}
main().catch((err) => {
  console.error("[sar] failed:", err);
  process.exit(1);
});
