#!/usr/bin/env node
import { assessCapabilities } from "../core/capabilities";
async function main() {
  const report = await assessCapabilities();
  if (report.gaps.length) {
    console.log("Capability gaps:");
    for (const g of report.gaps) {
      console.log(`- ${g.capability}: ${g.reason} -> ${g.recommendation}`);
    }
  } else {
    console.log("No capability gaps detected (placeholder).");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
