export * from "./core/release-calc";
export * from "./core/content-update";
export * from "./core/git";
export * from "./core/guards";
export * from "./core/capabilities";
export * from "./core/publish";
export * from "./types/errors";

/*
============================================
Planned Orchestrator (Commented Blueprint)
============================================

import { calculateRelease } from './core/release-calc';
import { applyContentUpdate } from './core/content-update';
import { ensureCleanWorkingTree, createBranch, commitAndPush, openPullRequest } from './core/git';
import { assertNoRace } from './core/guards';
import { assessCapabilities } from './core/capabilities';
import { publishArtifacts } from './core/publish';
import { PermissionError, ConfigError } from './types/errors';
import * as fs from 'fs';

// Orchestrator high-level steps (future implementation):
// 1. Capability assessment (optional in run mode if setup already done)
// 2. Release calculation (semantic-release dry-run)
// 3. Pre-flight race + permission checks
// 4. Content update (version bump + changelog)
// 5. Ephemeral branch creation + commit
// 6. Pull Request creation
// 7. Merge (manual or automated in later phase)
// 8. Publish (npm + GitHub Release + tag)
// 9. Cleanup (branch delete) -- later

// Example (future) function showing intended flow:
// export async function runRelease(options: { changelogFile?: string }) {
//   const changelogFile = options.changelogFile || 'CHANGELOG.md';
//   const caps = await assessCapabilities();
//   if (caps.gaps.length) {
//     throw new PermissionError('Capability gaps detected: ' + caps.gaps.map(g=>g.capability).join(', '));
//   }
//
//   await ensureCleanWorkingTree();
//   const calc = await calculateRelease();
//
//   // Race detection placeholder (replace currentHeadSha retrieval later)
//   const currentHeadSha = 'HEAD';
//   assertNoRace(calc.baseCommit, currentHeadSha);
//
//   await applyContentUpdate({ version: calc.version, notes: calc.notes, changelogFile });
//
//   const branchName = `temp_release_${Date.now()}`;
//   await createBranch(branchName, calc.baseCommit);
//   await commitAndPush(`chore(release): ${calc.version}`, [changelogFile, 'package.json']);
//
//   const pr = await openPullRequest(`Release ${calc.version}`, 'Automated release PR', branchName, calc.defaultBranch);
//
//   // In first iteration publishing waits for manual merge; later we can auto-detect merge & continue.
//   // Placeholder publish call (will likely move post-merge):
//   await publishArtifacts(calc.version, calc.notes);
//
//   fs.writeFileSync('.sar_last.json', JSON.stringify({ prNumber: pr.number, version: calc.version }, null, 2));
//   return { version: calc.version, prNumber: pr.number };
// }

// NOTE:
// - Keep this blueprint commented until incremental modules are implemented & tested.
// - Avoid exposing partially working orchestrator to consumers prematurely.
*/
