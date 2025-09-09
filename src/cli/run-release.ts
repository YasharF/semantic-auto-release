#!/usr/bin/env node
import { calculateRelease } from "../core/release-calc";
import { applyContentUpdate } from "../core/content-update";
import { publishArtifacts } from "../core/publish";

async function main() {
  const calc = await calculateRelease();
  await applyContentUpdate({
    version: calc.version,
    notes: calc.notes,
    changelogFile: process.env.CHANGELOG_FILE || "CHANGELOG.md",
  });
  if (calc.noRelease) {
    console.log("[sar] no release required");
    return;
  }
  await publishArtifacts(calc.version, calc.notes);
  console.log(
    `[sar] release flow completed (placeholder) version=${calc.version}`,
  );
}
main().catch((err) => {
  console.error("[sar] failed:", err);
  process.exit(1);
});
