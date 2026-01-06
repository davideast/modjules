import {
  GitHubAuthError,
  GitHubError,
  GitHubNotFoundError,
  GitHubRateLimitError,
} from './errors.js';

export class GitHubApiClient {
  constructor(
    private token: string,
    private baseUrl: string = 'https://api.github.com',
  ) {}

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Clone headers to avoid modifying the original options object
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let body: any;
      try {
        body = await response.json();
      } catch (e) {
        body = {
          message: `Request failed with status ${response.status} and non-JSON body`,
        };
      }

      if (response.status === 401) {
        throw new GitHubAuthError(
          body.message || 'Authentication failed. Please check your token.',
        );
      }
      if (response.status === 404) {
        throw new GitHubNotFoundError(endpoint);
      }
      if (response.status === 403 || response.status === 429) {
        const limit = parseInt(
          response.headers.get('x-ratelimit-limit') || '0',
          10,
        );
        const remaining = parseInt(
          response.headers.get('x-ratelimit-remaining') || '0',
          10,
        );
        const resetTimestamp = parseInt(
          response.headers.get('x-ratelimit-reset') || '0',
          10,
        );
        const resetAt = new Date(resetTimestamp * 1000);
        throw new GitHubRateLimitError(resetAt, limit, remaining);
      }

      throw new GitHubError(
        body.message || `Request failed with status ${response.status}`,
        response.status,
        body,
      );
    }

    if (
      response.status === 204 ||
      response.headers.get('Content-Length') === '0'
    ) {
      return undefined as T;
    }

    return response.json();
  }
}
