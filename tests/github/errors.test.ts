import { describe, it, expect } from 'vitest';
import {
  GitHubError,
  GitHubNotFoundError,
  GitHubAuthError,
  GitHubRateLimitError,
} from '../../src/github/errors.js';

describe('GitHub Errors', () => {
  it('should create a GitHubError', () => {
    const error = new GitHubError('Something went wrong', 500, { detail: 'server fault' });
    expect(error).toBeInstanceOf(GitHubError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GitHubError');
    expect(error.message).toBe('Something went wrong');
    expect(error.status).toBe(500);
    expect(error.response).toEqual({ detail: 'server fault' });
  });

  it('should create a GitHubNotFoundError', () => {
    const error = new GitHubNotFoundError('/users/notfound');
    expect(error).toBeInstanceOf(GitHubNotFoundError);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.name).toBe('GitHubNotFoundError');
    expect(error.message).toBe('GitHub resource not found: /users/notfound');
    expect(error.status).toBe(404);
  });

  it('should create a GitHubAuthError', () => {
    const error = new GitHubAuthError('Bad credentials');
    expect(error).toBeInstanceOf(GitHubAuthError);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.name).toBe('GitHubAuthError');
    expect(error.message).toBe('Bad credentials');
    expect(error.status).toBe(401);
  });

  it('should create a GitHubRateLimitError', () => {
    const resetDate = new Date();
    const error = new GitHubRateLimitError(resetDate, 5000, 0);
    expect(error).toBeInstanceOf(GitHubRateLimitError);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.name).toBe('GitHubRateLimitError');
    expect(error.message).toBe(`GitHub rate limit exceeded. Resets at ${resetDate.toISOString()}`);
    expect(error.status).toBe(429);
    expect(error.resetAt).toBe(resetDate);
    expect(error.limit).toBe(5000);
    expect(error.remaining).toBe(0);
  });
});
