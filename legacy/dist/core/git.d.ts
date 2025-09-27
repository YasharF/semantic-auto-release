export declare function ensureCleanWorkingTree(): Promise<void>;
export declare function createBranch(
  _name: string,
  _base: string,
): Promise<void>;
export declare function commitAndPush(
  _message: string,
  _files: string[],
): Promise<void>;
export declare function openPullRequest(
  _title: string,
  _body: string,
  _head: string,
  _base: string,
): Promise<{
  number: number;
}>;
