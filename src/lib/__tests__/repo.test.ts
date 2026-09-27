import { describe, expect, it } from 'vitest';
import { parseGitHubRepoUrl, repoToString } from '../repo';

describe('parseGitHubRepoUrl', () => {
  it('parses https GitHub URLs', () => {
    expect(parseGitHubRepoUrl('https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('parses shorthand owner/repo values', () => {
    expect(parseGitHubRepoUrl('vitejs/vite')).toEqual({ owner: 'vitejs', repo: 'vite' });
  });

  it('parses SSH URLs and strips .git', () => {
    expect(parseGitHubRepoUrl('git@github.com:vuejs/core.git')).toEqual({ owner: 'vuejs', repo: 'core' });
  });

  it('rejects non-GitHub hosts', () => {
    expect(parseGitHubRepoUrl('https://gitlab.com/foo/bar')).toBeNull();
  });

  it('formats repository coordinates', () => {
    expect(repoToString({ owner: 'owner', repo: 'repo' })).toBe('owner/repo');
  });
});
