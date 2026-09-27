import type { RepoCoordinates } from '../types';

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

export function parseGitHubRepoUrl(input: string): RepoCoordinates | null {
  const value = input.trim();
  if (!value) return null;

  const shorthand = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (shorthand) {
    return sanitizeRepo({ owner: shorthand[1], repo: shorthand[2] });
  }

  const ssh = value.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (ssh) {
    return sanitizeRepo({ owner: ssh[1], repo: ssh[2] });
  }

  const httpsWithoutScheme = value.startsWith('github.com/') ? `https://${value}` : value;

  try {
    const url = new URL(httpsWithoutScheme);
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
    const [owner, repo] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repo) return null;
    return sanitizeRepo({ owner, repo: repo.replace(/\.git$/, '') });
  } catch {
    return null;
  }
}

export function repoToString(repo: RepoCoordinates): string {
  return `${repo.owner}/${repo.repo}`;
}

export function repoUrl(repo: RepoCoordinates): string {
  return `https://github.com/${repo.owner}/${repo.repo}`;
}

function sanitizeRepo(repo: RepoCoordinates): RepoCoordinates | null {
  const valid = /^[A-Za-z0-9_.-]+$/;
  if (!valid.test(repo.owner) || !valid.test(repo.repo)) return null;
  return repo;
}
