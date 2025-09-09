export interface CapabilityGap {
  capability: string;
  reason: string;
  recommendation: string;
}
export type BranchProtectionType =
  | "none"
  | "classic"
  | "rules"
  | "classic+rules"
  | "unknown";
export interface CapabilityContext {
  visibility?: "public" | "private";
  branchProtection: BranchProtectionType;
  defaultBranch?: string;
  usableTokens: string[];
  autoMergeEnabled?: boolean;
  allowSquashMerge?: boolean;
  requiredStatusChecksEnabled?: boolean;
  requiredStatusCheckContexts?: string[];
  requiredApprovals?: number;
  prRequired?: boolean;
}
export interface CapabilityReport {
  gaps: CapabilityGap[];
  context: CapabilityContext;
  tokenMatrix: Record<string, TokenCapabilities>;
  capabilityMinimumTokens?: Record<string, string[]>;
}
export interface TokenCapabilities {
  token: string;
  valid: boolean;
  repoRead: boolean;
  canListBranches: boolean;
  canReadBranchProtection: boolean;
  isAdmin: boolean;
  canPush: boolean;
}
export interface AssessOptions {
  fixtureDir?: string;
  required?: Partial<
    Pick<TokenCapabilities, "repoRead" | "canPush" | "canListBranches">
  >;
  repo?: string;
  branch?: string;
  tokens?: string[];
}
/**
 * Assess repository automation capabilities from either:
 *  - recorded fixture directory (deterministic tests)
 *  - live GitHub API (best-effort minimal probing) if no fixtureDir supplied
 */
export declare function assessCapabilities(
  opts?: AssessOptions,
): Promise<CapabilityReport>;
