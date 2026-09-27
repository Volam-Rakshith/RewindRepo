import type {
  BranchInfo,
  CommitInfo,
  CompareFile,
  CompareResult,
  FileContent,
  GitTreeItem,
  ReleaseInfo,
  RepoCoordinates,
  RepositoryInfo,
  RepoTree,
  TagInfo,
  TimelineData,
  TimelinePoint
} from '../types';
import { cacheKey, getCached, setCached } from './cache';
import { GitHubApiError } from './errors';
import { buildTree } from './tree';
import { decodeBase64Utf8, isBinaryString, isProbablyTextPath, MAX_TEXT_FILE_BYTES } from './text';

const API_BASE = 'https://api.github.com';
const DEFAULT_TTL = 1000 * 60 * 8;
const LONG_TTL = 1000 * 60 * 60 * 12;

async function githubFetch<T>(path: string, ttlMs = DEFAULT_TTL, init?: RequestInit): Promise<T> {
  const key = cacheKey(['github', path, init?.method ?? 'GET']);
  const cached = getCached<T>(key);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed: ${response.statusText}`;
    throw new GitHubApiError(message, response.status, body, response.headers);
  }

  const json = (await response.json()) as T;
  setCached(key, json, ttlMs);
  return json;
}

function encodePathPart(part: string): string {
  return encodeURIComponent(part).replace(/%2F/g, '/');
}

function repoPath(repo: RepoCoordinates, suffix: string): string {
  return `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}${suffix}`;
}

function mapCommit(raw: GitHubCommitResponse): CommitInfo {
  return {
    sha: raw.sha,
    shortSha: raw.sha.slice(0, 7),
    message: raw.commit.message.split('\n')[0] || '(no commit message)',
    authorName: raw.commit.author?.name ?? raw.author?.login ?? 'unknown',
    authorDate: raw.commit.author?.date ?? raw.commit.committer?.date ?? new Date().toISOString(),
    committerDate: raw.commit.committer?.date ?? raw.commit.author?.date ?? new Date().toISOString(),
    url: raw.html_url,
    parents: raw.parents?.map((parent) => parent.sha) ?? []
  };
}

export async function getRepository(repo: RepoCoordinates): Promise<RepositoryInfo> {
  const raw = await githubFetch<GitHubRepoResponse>(repoPath(repo, ''), LONG_TTL);
  return {
    id: raw.id,
    owner: raw.owner.login,
    repo: raw.name,
    fullName: raw.full_name,
    description: raw.description,
    defaultBranch: raw.default_branch,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    isArchived: raw.archived,
    pushedAt: raw.pushed_at,
    htmlUrl: raw.html_url,
    sizeKb: raw.size,
    visibility: raw.visibility
  };
}

export async function getBranches(repo: RepoCoordinates): Promise<BranchInfo[]> {
  const raw = await githubFetch<GitHubBranchResponse[]>(repoPath(repo, '/branches?per_page=100'), LONG_TTL);
  return raw.map((branch) => ({
    name: branch.name,
    sha: branch.commit.sha,
    protected: branch.protected
  }));
}

export async function getCommits(
  repo: RepoCoordinates,
  branch: string,
  options: { perPage?: number; until?: string; since?: string } = {}
): Promise<CommitInfo[]> {
  const params = new URLSearchParams({
    sha: branch,
    per_page: String(options.perPage ?? 100)
  });
  if (options.until) params.set('until', options.until);
  if (options.since) params.set('since', options.since);
  const raw = await githubFetch<GitHubCommitResponse[]>(repoPath(repo, `/commits?${params.toString()}`), DEFAULT_TTL);
  return raw.map(mapCommit);
}

export async function getTags(repo: RepoCoordinates): Promise<TagInfo[]> {
  const raw = await githubFetch<GitHubTagResponse[]>(repoPath(repo, '/tags?per_page=100'), LONG_TTL);
  return raw.map((tag) => ({
    name: tag.name,
    sha: tag.commit.sha,
    zipballUrl: tag.zipball_url,
    tarballUrl: tag.tarball_url
  }));
}

export async function getReleases(repo: RepoCoordinates): Promise<ReleaseInfo[]> {
  const raw = await githubFetch<GitHubReleaseResponse[]>(repoPath(repo, '/releases?per_page=100'), LONG_TTL);
  return raw.map((release) => ({
    id: release.id,
    name: release.name,
    tagName: release.tag_name,
    targetCommitish: release.target_commitish,
    createdAt: release.created_at,
    publishedAt: release.published_at,
    prerelease: release.prerelease,
    draft: release.draft,
    htmlUrl: release.html_url
  }));
}

export async function resolveCommit(repo: RepoCoordinates, ref: string): Promise<CommitInfo> {
  const encoded = encodePathPart(ref);
  const raw = await githubFetch<GitHubCommitResponse>(repoPath(repo, `/commits/${encoded}`), LONG_TTL);
  return mapCommit(raw);
}

export async function getLatestCommitBeforeDate(
  repo: RepoCoordinates,
  branch: string,
  date: string
): Promise<CommitInfo | null> {
  const commits = await getCommits(repo, branch, { until: new Date(date).toISOString(), perPage: 1 });
  return commits[0] ?? null;
}

export async function getTimeline(repo: RepoCoordinates, branch: string): Promise<TimelineData> {
  const [commits, tags, releases] = await Promise.all([
    getCommits(repo, branch, { perPage: 100 }),
    getTags(repo),
    getReleases(repo)
  ]);

  const commitBySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const points: TimelinePoint[] = [];

  for (const commit of commits) {
    points.push({
      id: `commit:${commit.sha}`,
      kind: 'commit',
      label: commit.shortSha,
      ref: commit.sha,
      sha: commit.sha,
      date: commit.authorDate,
      title: commit.message,
      description: `${commit.authorName} · ${new Date(commit.authorDate).toLocaleString()}`,
      url: commit.url
    });
  }

  for (const tag of tags) {
    const commit = commitBySha.get(tag.sha);
    points.push({
      id: `tag:${tag.name}`,
      kind: 'tag',
      label: tag.name,
      ref: tag.name,
      sha: tag.sha,
      date: commit?.authorDate ?? new Date().toISOString(),
      title: `Tag ${tag.name}`,
      description: tag.sha.slice(0, 7)
    });
  }

  for (const release of releases.filter((release) => !release.draft)) {
    points.push({
      id: `release:${release.id}`,
      kind: 'release',
      label: release.name || release.tagName,
      ref: release.tagName,
      date: release.publishedAt ?? release.createdAt,
      title: `Release ${release.name || release.tagName}`,
      description: `${release.prerelease ? 'Pre-release' : 'Release'} · ${release.tagName}`,
      url: release.htmlUrl
    });
  }

  const deduped = dedupePoints(points).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return {
    points: deduped,
    commits,
    tags,
    releases,
    activity: buildActivityBuckets(commits),
    limited: commits.length >= 100
  };
}

function dedupePoints(points: TimelinePoint[]): TimelinePoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.kind}:${point.ref}:${point.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildActivityBuckets(commits: CommitInfo[]) {
  if (commits.length === 0) return [];
  const dates = commits.map((commit) => new Date(commit.authorDate).getTime()).sort((a, b) => a - b);
  const start = dates[0];
  const end = dates[dates.length - 1] || start;
  const bucketCount = Math.min(18, Math.max(6, Math.ceil(commits.length / 8)));
  const width = Math.max(1, (end - start) / bucketCount);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: new Date(start + index * width).toISOString(),
    end: new Date(start + (index + 1) * width).toISOString(),
    count: 0
  }));
  for (const timestamp of dates) {
    const index = Math.min(bucketCount - 1, Math.floor((timestamp - start) / width));
    buckets[index].count += 1;
  }
  return buckets;
}

export async function getTree(repo: RepoCoordinates, sha: string): Promise<RepoTree> {
  const raw = await githubFetch<GitHubTreeResponse>(repoPath(repo, `/git/trees/${sha}?recursive=1`), DEFAULT_TTL);
  const items = raw.tree.filter((item) => item.path) as GitTreeItem[];
  return {
    sha: raw.sha,
    truncated: raw.truncated,
    items,
    root: buildTree(items)
  };
}

export async function getBlob(repo: RepoCoordinates, path: string, sha: string, size?: number): Promise<FileContent> {
  const tooLarge = typeof size === 'number' && size > MAX_TEXT_FILE_BYTES;
  const textPath = isProbablyTextPath(path);
  if (tooLarge || !textPath) {
    return {
      path,
      sha,
      size: size ?? 0,
      encoding: 'base64',
      isBinary: !textPath,
      isTooLarge: tooLarge
    };
  }

  const raw = await githubFetch<GitHubBlobResponse>(repoPath(repo, `/git/blobs/${sha}`), LONG_TTL);
  const text = decodeBase64Utf8(raw.content);
  const binary = isBinaryString(text);
  return {
    path,
    sha: raw.sha,
    size: raw.size,
    encoding: raw.encoding,
    isBinary: binary,
    isTooLarge: raw.size > MAX_TEXT_FILE_BYTES,
    text: binary || raw.size > MAX_TEXT_FILE_BYTES ? undefined : text
  };
}

export async function getFileTextAtRef(repo: RepoCoordinates, ref: string, path: string): Promise<string | null> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const params = new URLSearchParams({ ref });
  try {
    const raw = await githubFetch<GitHubContentFileResponse>(
      repoPath(repo, `/contents/${encodedPath}?${params.toString()}`),
      DEFAULT_TTL
    );
    if (Array.isArray(raw) || raw.type !== 'file' || raw.size > MAX_TEXT_FILE_BYTES) return null;
    return decodeBase64Utf8(raw.content);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return null;
    throw error;
  }
}

export async function compareRefs(repo: RepoCoordinates, base: string, head: string): Promise<CompareResult> {
  const raw = await githubFetch<GitHubCompareResponse>(
    repoPath(repo, `/compare/${encodePathPart(base)}...${encodePathPart(head)}`),
    DEFAULT_TTL
  );
  return {
    url: raw.url,
    htmlUrl: raw.html_url,
    status: raw.status,
    aheadBy: raw.ahead_by,
    behindBy: raw.behind_by,
    totalCommits: raw.total_commits,
    baseCommit: mapCommit(raw.base_commit),
    headCommit: mapCommit(raw.merge_base_commit?.sha === raw.head_commit.sha ? raw.head_commit : raw.head_commit),
    files: (raw.files ?? []).map(mapCompareFile),
    tooLarge: raw.files === undefined && raw.total_commits > 250
  };
}

function mapCompareFile(raw: GitHubCompareFileResponse): CompareFile {
  return {
    sha: raw.sha,
    filename: raw.filename,
    previousFilename: raw.previous_filename,
    status: raw.status,
    additions: raw.additions,
    deletions: raw.deletions,
    changes: raw.changes,
    patch: raw.patch,
    blobUrl: raw.blob_url,
    rawUrl: raw.raw_url
  };
}

type GitHubRepoResponse = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  pushed_at: string | null;
  html_url: string;
  size: number;
  visibility: string;
  owner: { login: string };
};

type GitHubBranchResponse = {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
};

type GitHubCommitResponse = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string };
    committer?: { name?: string; date?: string };
  };
  author?: { login: string } | null;
  parents?: Array<{ sha: string }>;
};

type GitHubTagResponse = {
  name: string;
  zipball_url: string;
  tarball_url: string;
  commit: { sha: string; url: string };
};

type GitHubReleaseResponse = {
  id: number;
  name: string | null;
  tag_name: string;
  target_commitish: string;
  created_at: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
};

type GitHubTreeResponse = {
  sha: string;
  url: string;
  tree: Array<GitTreeItem>;
  truncated: boolean;
};

type GitHubBlobResponse = {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  content: string;
  encoding: string;
};

type GitHubContentFileResponse = {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
};

type GitHubCompareResponse = {
  url: string;
  html_url: string;
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  base_commit: GitHubCommitResponse;
  merge_base_commit?: GitHubCommitResponse;
  head_commit: GitHubCommitResponse;
  files?: GitHubCompareFileResponse[];
};

type GitHubCompareFileResponse = {
  sha: string;
  filename: string;
  previous_filename?: string;
  status: CompareFile['status'];
  additions: number;
  deletions: number;
  changes: number;
  blob_url?: string;
  raw_url?: string;
  patch?: string;
};
