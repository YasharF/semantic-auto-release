export interface ReleaseCalcResult {
  version: string | undefined;
  notes: string;
  defaultBranch: string;
  baseCommit: string;
  noRelease?: boolean;
}
export interface CalculateReleaseOptions {
  cwd?: string;
  branch?: string;
}
/**
 * Runs semantic-release in dry-run mode to determine next release.
 * Returns noRelease=true when semantic-release reports no new version.
 */
export declare function calculateRelease(
  opts?: CalculateReleaseOptions,
): Promise<ReleaseCalcResult>;
