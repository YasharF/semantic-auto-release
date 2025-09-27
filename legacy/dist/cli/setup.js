#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const capabilities_1 = require("../core/capabilities");
async function main() {
  const report = await (0, capabilities_1.assessCapabilities)();
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
