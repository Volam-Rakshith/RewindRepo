import type { AppError } from '../types';

export class GitHubApiError extends Error {
  status: number;
  response?: unknown;
  rateLimitRemaining?: string | null;
  rateLimitReset?: string | null;

  constructor(message: string, status: number, response?: unknown, headers?: Headers) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.response = response;
    this.rateLimitRemaining = headers?.get('x-ratelimit-remaining');
    this.rateLimitReset = headers?.get('x-ratelimit-reset');
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof GitHubApiError) {
    if (error.status === 403 && error.rateLimitRemaining === '0') {
      const resetSeconds = Number(error.rateLimitReset ?? 0) * 1000;
      const reset = resetSeconds ? new Date(resetSeconds).toLocaleTimeString() : 'later';
      return {
        kind: 'api-rate-limit',
        title: 'GitHub API rate limit reached',
        message: `GitHub denied the request because the anonymous API limit was exhausted. Limit resets around ${reset}.`,
        recovery: 'Wait for the limit to reset, try a smaller timeline range, or run a deployment with a server-side GitHub token.',
        status: error.status
      };
    }
    if (error.status === 404) {
      return {
        kind: 'repository-unavailable',
        title: 'Repository, commit, or file unavailable',
        message: error.message,
        recovery: 'Check that the repository is public and that the selected historical reference still exists.',
        status: error.status
      };
    }
    if (error.status === 409 || error.status === 422) {
      return {
        kind: 'deleted-commit',
        title: 'Historical object unavailable',
        message: error.message,
        recovery: 'The commit may be deleted, unreachable, too large to compare, or unavailable through the public API.',
        status: error.status
      };
    }
    return {
      kind: 'unknown',
      title: `GitHub API error ${error.status}`,
      message: error.message,
      recovery: 'Try again or choose a different repository/reference.',
      status: error.status
    };
  }

  if (error instanceof TypeError) {
    return {
      kind: 'network-failure',
      title: 'Network request failed',
      message: error.message,
      recovery: 'Check your network connection and retry.'
    };
  }

  if (error instanceof Error) {
    return {
      kind: 'unknown',
      title: 'Unexpected error',
      message: error.message,
      recovery: 'Try the action again. If it repeats, open an issue with reproduction steps.'
    };
  }

  return {
    kind: 'unknown',
    title: 'Unexpected error',
    message: 'An unknown error occurred.',
    recovery: 'Try again.'
  };
}
