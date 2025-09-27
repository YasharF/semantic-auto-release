import { execSync } from "node:child_process";
import { UnexpectedError } from "../types/errors";

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
export async function calculateRelease(
  opts: CalculateReleaseOptions = {},
): Promise<ReleaseCalcResult> {
  const cwd = opts.cwd || process.cwd();
  const branch = opts.branch || "main";
  const headSha = git(cwd, "rev-parse HEAD").trim();

  let srResult: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const srMod = require("semantic-release");
    const semanticRelease = srMod.default || srMod; // handle possible default export
    srResult = await semanticRelease(
      {
        branches: [{ name: branch }],
        dryRun: true,
        ci: false,
        plugins: [
          "@semantic-release/commit-analyzer",
          "@semantic-release/release-notes-generator",
        ],
      },
      { cwd },
    );
  } catch (err: any) {
    throw new UnexpectedError(
      "semantic-release invocation failed: " + (err?.message || String(err)),
    );
  }

  if (!srResult || !srResult.nextRelease) {
    return {
      version: undefined,
      notes: "",
      defaultBranch: branch,
      baseCommit: headSha,
      noRelease: true,
    };
  }

  return {
    version: srResult.nextRelease.version,
    notes: srResult.nextRelease.notes || "",
    defaultBranch: srResult.branch?.name || branch,
    baseCommit: srResult.lastRelease?.gitHead || headSha,
    noRelease: false,
  };
}

function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString();
}
