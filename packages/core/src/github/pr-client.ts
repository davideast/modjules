import type { GitHubApiClient } from './api.js';
import { isPRCacheValid } from './caching.js';
import type { PRClient, PRResource, CachedPR, GitHubUser } from './types.js';

function mapUser(raw: any): GitHubUser {
  if (!raw) return null as any; // Should not happen for author
  return {
    id: raw.id,
    login: raw.login,
    type: raw.type,
    avatarUrl: raw.avatar_url,
  };
}

function mapToPRResource(raw: any): PRResource {
  return {
    id: raw.id,
    number: raw.number,
    nodeId: raw.node_id,
    url: raw.html_url,
    apiUrl: raw.url,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state,
    merged: raw.merged,
    draft: raw.draft,
    mergeable: raw.mergeable,
    mergeableState: raw.mergeable_state,
    baseRef: raw.base.ref,
    headRef: raw.head.ref,
    baseCommitSha: raw.base.sha,
    headCommitSha: raw.head.sha,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changed_files,
    commits: raw.commits,
    author: mapUser(raw.user),
    assignees: (raw.assignees || []).map(mapUser),
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
    mergedAt: raw.merged_at ? new Date(raw.merged_at) : null,
    closedAt: raw.closed_at ? new Date(raw.closed_at) : null,
  };
}

export class PRClientImpl implements PRClient {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly sessionId?: string;

  private cache?: CachedPR;

  constructor(
    private api: GitHubApiClient,
    owner: string,
    repo: string,
    number: number,
    sessionId?: string,
  ) {
    this.owner = owner;
    this.repo = repo;
    this.number = number;
    this.sessionId = sessionId;
  }

  async info(): Promise<PRResource> {
    if (this.cache && isPRCacheValid(this.cache)) {
      return this.cache.resource;
    }

    const data = await this.api.request<any>(
      `/repos/${this.owner}/${this.repo}/pulls/${this.number}`,
    );

    const resource = mapToPRResource(data);

    this.cache = { resource, _lastSyncedAt: Date.now() };

    return resource;
  }
}
