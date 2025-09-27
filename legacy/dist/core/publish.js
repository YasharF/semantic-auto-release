"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishArtifacts = publishArtifacts;
async function publishArtifacts(version, _notes) {
  if (!version) {
    // Nothing to publish
    return;
  }
  // TODO: npm publish + GitHub release creation
}
