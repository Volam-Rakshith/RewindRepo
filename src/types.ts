export type RepoCoordinates = {
  owner: string;
  repo: string;
};

export type RepositoryInfo = RepoCoordinates & {
  id: number;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  isArchived: boolean;
  pushedAt: string | null;
  htmlUrl: string;
  sizeKb: number;
  visibility: 'public' | 'private' | string;
};

export type BranchInfo = {
  name: string;
  sha: string;
  protected: boolean;
};

export type CommitInfo = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorDate: string;
  committerDate: string;
  url: string;
  parents: string[];
};

export type TagInfo = {
  name: string;
  sha: string;
  zipballUrl?: string;
  tarballUrl?: string;
};

export type ReleaseInfo = {
  id: number;
  name: string | null;
  tagName: string;
  targetCommitish: string;
  createdAt: string;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
  htmlUrl: string;
};

export type TimelineKind = 'commit' | 'tag' | 'release' | 'date';

export type TimelinePoint = {
  id: string;
  kind: TimelineKind;
  label: string;
  ref: string;
  sha?: string;
  date: string;
  title: string;
  description?: string;
  url?: string;
};

export type ActivityBucket = {
  start: string;
  end: string;
  count: number;
};

export type TimelineData = {
  points: TimelinePoint[];
  commits: CommitInfo[];
  tags: TagInfo[];
  releases: ReleaseInfo[];
  activity: ActivityBucket[];
  limited: boolean;
};

export type GitTreeItem = {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url?: string;
};

export type TreeNode = {
  name: string;
  path: string;
  type: 'tree' | 'blob' | 'commit';
  sha?: string;
  size?: number;
  children: TreeNode[];
};

export type RepoTree = {
  sha: string;
  truncated: boolean;
  items: GitTreeItem[];
  root: TreeNode;
};

export type FileContent = {
  path: string;
  sha: string;
  size: number;
  encoding: string;
  isBinary: boolean;
  isTooLarge: boolean;
  text?: string;
  downloadUrl?: string;
};

export type CompareFileStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

export type CompareFile = {
  sha: string;
  filename: string;
  previousFilename?: string;
  status: CompareFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blobUrl?: string;
  rawUrl?: string;
};

export type CompareResult = {
  url: string;
  htmlUrl: string;
  status: 'ahead' | 'behind' | 'identical' | 'diverged' | string;
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  baseCommit: CommitInfo;
  headCommit: CommitInfo;
  files: CompareFile[];
  tooLarge?: boolean;
};

export type DependencyChange = {
  file: string;
  ecosystem: string;
  packageName: string;
  before?: string;
  after?: string;
  type: 'added' | 'removed' | 'changed';
};

export type PreviewCapability = {
  supported: boolean;
  kind: 'static-html' | 'markdown' | 'source-only' | 'unsupported-build';
  title: string;
  reason: string;
  entryPath?: string;
  warnings: string[];
};

export type AppErrorKind =
  | 'repository-unavailable'
  | 'deleted-commit'
  | 'unavailable-file'
  | 'api-rate-limit'
  | 'huge-repository'
  | 'binary-file'
  | 'unsupported-project'
  | 'build-failure'
  | 'network-failure'
  | 'unknown';

export type AppError = {
  kind: AppErrorKind;
  title: string;
  message: string;
  recovery?: string;
  status?: number;
};
