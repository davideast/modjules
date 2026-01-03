import { GitHubApiClient } from './api.js';
import { PRClientImpl } from './pr-client.js';
import type {
  GitHubAdapter,
  GitHubConfig,
  GitHubUser,
  PRClient,
  RateLimitInfo,
} from './types.js';

// A mapping function to transform the raw user object from the API
function mapUser(rawUser: any): GitHubUser {
  return {
    id: rawUser.id,
    login: rawUser.login,
    type: rawUser.type,
    avatarUrl: rawUser.avatar_url,
  };
}

export function github(config: GitHubConfig): GitHubAdapter {
  return new GitHubAdapterImpl(config);
}

class GitHubAdapterImpl implements GitHubAdapter {
  private api: GitHubApiClient;

  constructor(private config: GitHubConfig) {
    this.api = new GitHubApiClient(config.token, config.baseUrl);
  }

  pr(
    repoOrOptionsOrUrl:
      | string
      | { owner: string; repo: string; number: number },
    number?: number,
  ): PRClient {
    if (typeof repoOrOptionsOrUrl === 'string') {
      // Overload 1: pr('owner/repo', 123)
      if (typeof number === 'number') {
        const [owner, repo] = repoOrOptionsOrUrl.split('/');
        if (!owner || !repo) {
          throw new Error('Invalid repo string. Expected format: "owner/repo"');
        }
        return new PRClientImpl(this.api, owner, repo, number);
      }

      // Overload 3: pr('https://github.com/owner/repo/pull/123')
      const parsed = this.parsePrUrl(repoOrOptionsOrUrl);
      if (parsed) {
        return new PRClientImpl(
          this.api,
          parsed.owner,
          parsed.repo,
          parsed.number,
        );
      }
      throw new Error('Invalid PR URL or repo string.');
    }

    // Overload 2: pr({ owner, repo, number })
    if (typeof repoOrOptionsOrUrl === 'object' && repoOrOptionsOrUrl !== null) {
      const { owner, repo, number: prNumber } = repoOrOptionsOrUrl;
      return new PRClientImpl(this.api, owner, repo, prNumber);
    }

    throw new Error('Invalid arguments for pr() method.');
  }

  parsePrUrl(
    url: string,
  ): { owner: string; repo: string; number: number } | null {
    const match = url.match(
      /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/pull\/(\d+)/,
    );
    if (match && match[1] && match[2] && match[3]) {
      return {
        owner: match[1],
        repo: match[2],
        number: parseInt(match[3], 10),
      };
    }
    return null;
  }

  async viewer(): Promise<GitHubUser> {
    const rawUser = await this.api.request<any>('/user');
    return mapUser(rawUser);
  }

  async rateLimit(): Promise<RateLimitInfo> {
    const data = await this.api.request<any>('/rate_limit');
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      used: data.rate.used,
      reset: new Date(data.rate.reset * 1000),
    };
  }
}
