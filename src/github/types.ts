export interface GitHubConfig {
  token: string;
  baseUrl?: string; // Default: 'https://api.github.com'
  pollingIntervalMs?: number; // Default: 30000
}

export interface GitHubUser {
  id: number;
  login: string;
  type: 'User' | 'Bot' | 'Organization';
  avatarUrl?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  used: number;
  reset: Date;
}

export interface PRResource {
  id: number;
  number: number;
  nodeId: string;
  url: string;
  apiUrl: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  mergeable: boolean | null;
  mergeableState:
    | 'clean'
    | 'dirty'
    | 'blocked'
    | 'behind'
    | 'unstable'
    | 'unknown';
  baseRef: string;
  headRef: string;
  baseCommitSha: string;
  headCommitSha: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  author: GitHubUser;
  assignees: GitHubUser[];
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date | null;
  closedAt?: Date | null;
}

export interface CachedPR {
  resource: PRResource;
  _lastSyncedAt: number;
}

export interface GitHubAdapter {
  pr(repo: string, number: number): PRClient;
  pr(options: { owner: string; repo: string; number: number }): PRClient;
  pr(url: string): PRClient;
  parsePrUrl(
    url: string,
  ): { owner: string; repo: string; number: number } | null;
  viewer(): Promise<GitHubUser>;
  rateLimit(): Promise<RateLimitInfo>;
}

export interface PRClient {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly sessionId?: string;
  info(): Promise<PRResource>;
}
