export interface ContentUpdateInput {
  version: string | undefined;
  notes: string;
  changelogFile?: string;
}
export declare function applyContentUpdate(
  input: ContentUpdateInput,
): Promise<void>;
