export async function publishArtifacts(
  version: string | undefined,
  _notes: string,
): Promise<void> {
  if (!version) {
    // Nothing to publish
    return;
  }
  // TODO: npm publish + GitHub release creation
}
