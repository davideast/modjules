# GitHub Integration Design for modjules

This document outlines the design for integrating GitHub PR management capabilities into the modjules SDK. The goal is to enable seamless tracking and management of Pull Requests created by Jules sessions.

## Table of Contents

1. [Overview](#overview)
2. [Main Abstraction: GitHubAdapter](#main-abstraction-githubadapter)
3. [Type Definitions](#type-definitions)
4. [Client Interfaces](#client-interfaces)
5. [Storage & Caching Architecture](#storage--caching-architecture)
6. [Event Sourcing for Mutable GitHub Data](#event-sourcing-for-mutable-github-data)
7. [Streaming Architecture](#streaming-architecture)
8. [Integration with JulesClient](#integration-with-julesclient)
9. [MCP Tool Design](#mcp-tool-design)
10. [Authentication Flow](#authentication-flow)
11. [Error Handling](#error-handling)
12. [Usage Examples](#usage-examples)

---

## Overview

### Current State

The SDK already has minimal PR awareness:

- `SessionResource.outputs` can include `{ type: 'pullRequest', url, title, description }`
- `SessionSnapshot.pr` exposes this
- `ChangeSet` artifacts contain git patches with `unidiffPatch`, `baseCommitId`, `suggestedCommitMessage`

But there's **no GitHub API integration** - no PR comments, checks, reviews, or management.

### Design Goals

1. **Session → PR linkage**: Easy access to PRs created by Jules sessions
2. **Standalone PR access**: Work with any GitHub PR, not just Jules-created ones
3. **Consistent patterns**: Follow existing modjules patterns (cold/hot streaming, caching)
4. **Optional integration**: Keep core SDK lean, GitHub is opt-in
5. **Extensible**: Support for GitLab/Bitbucket in the future

---

## Main Abstraction: GitHubAdapter

The central abstraction is a **GitHub Adapter** that plugs into the Jules client and enriches session-related PRs while also enabling standalone GitHub operations.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           JulesClient                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐   │
│  │   sessions  │  │   sources   │  │         github              │   │
│  │   (cursor)  │  │  (manager)  │  │  (GitHubAdapter, optional)  │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐
                  │  PRClient   │     │ RepoClient  │      │ActionsClient│
                  │             │     │  (future)   │      │  (future)   │
                  └─────────────┘     └─────────────┘      └─────────────┘
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
   │ Comments  │  │  Reviews  │  │  Checks   │  │  Files    │
   │  Client   │  │  Client   │  │  Client   │  │  Client   │
   └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

### GitHub Adapter Interface

```typescript
/**
 * Configuration for the GitHub adapter.
 */
export interface GitHubConfig {
  /**
   * GitHub Personal Access Token or GitHub App token.
   * Required for authenticated operations.
   */
  token: string;

  /**
   * Base URL for GitHub API. Useful for GitHub Enterprise.
   * @default 'https://api.github.com'
   */
  baseUrl?: string;

  /**
   * Polling interval for real-time updates (checks, comments).
   * @default 30000 (30 seconds)
   */
  pollingIntervalMs?: number;

  /**
   * Optional webhook configuration for real-time updates.
   * If provided, uses webhooks instead of polling.
   */
  webhook?: {
    secret: string;
    /** Callback URL that receives webhook payloads */
    callbackUrl?: string;
  };
}

/**
 * The GitHub Adapter that plugs into JulesClient.
 * Provides access to GitHub PR operations.
 */
export interface GitHubAdapter {
  /**
   * Get a PR client for a specific pull request.
   *
   * @example
   * const pr = await jules.github.pr('owner/repo', 123);
   * const pr = await jules.github.pr({ owner: 'foo', repo: 'bar', number: 123 });
   * const pr = await jules.github.pr('https://github.com/owner/repo/pull/123');
   */
  pr(repo: string, number: number): PRClient;
  pr(options: { owner: string; repo: string; number: number }): PRClient;
  pr(url: string): PRClient;

  /**
   * Parse a GitHub PR URL into components.
   */
  parsePrUrl(
    url: string,
  ): { owner: string; repo: string; number: number } | null;

  /**
   * Get the authenticated user.
   */
  viewer(): Promise<GitHubUser>;

  /**
   * Check rate limit status.
   */
  rateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  }>;
}

/**
 * Factory function to create a GitHub adapter.
 */
export function github(config: GitHubConfig): GitHubAdapter;
```

---

## Type Definitions

### Core GitHub Types

```typescript
// =============================================================================
// src/github/types.ts - Core GitHub Types
// =============================================================================

/**
 * Represents a GitHub Pull Request with full metadata.
 */
export interface PRResource {
  // Identity
  id: number; // GitHub's internal PR ID
  number: number; // PR number (e.g., #123)
  nodeId: string; // GraphQL node ID

  // URLs
  url: string; // Web URL
  apiUrl: string; // API URL

  // Content
  title: string;
  body: string;

  // State
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  mergeable: boolean | null; // null = computing
  mergeableState:
    | 'clean'
    | 'dirty'
    | 'blocked'
    | 'behind'
    | 'unstable'
    | 'unknown';

  // Refs
  baseRef: string;
  headRef: string;
  baseCommitSha: string;
  headCommitSha: string;

  // Stats
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;

  // Users
  author: GitHubUser;
  assignees: GitHubUser[];
  requestedReviewers: GitHubUser[];

  // Metadata
  labels: Label[];
  milestone?: Milestone;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  closedAt?: Date;

  // Jules linkage (if created by a Jules session)
  julesSessionId?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatarUrl: string;
  type: 'User' | 'Bot' | 'Organization';
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface Milestone {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
}
```

### Comments

```typescript
export type CommentType = 'issue' | 'review' | 'line';

export interface Comment {
  id: number;
  type: CommentType;
  body: string;
  author: GitHubUser;
  createdAt: Date;
  updatedAt: Date;

  // For line comments
  path?: string;
  line?: number;
  side?: 'LEFT' | 'RIGHT';

  // For review comments
  reviewId?: number;
  inReplyToId?: number;

  // Reactions
  reactions: ReactionSummary;
}

export interface ReactionSummary {
  totalCount: number;
  '+1': number;
  '-1': number;
  laugh: number;
  confused: number;
  heart: number;
  hooray: number;
  rocket: number;
  eyes: number;
}
```

### Reviews

```typescript
export type ReviewState =
  | 'PENDING'
  | 'COMMENTED'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'DISMISSED';

export interface Review {
  id: number;
  state: ReviewState;
  body: string;
  author: GitHubUser;
  submittedAt: Date;
  commitId: string;
  comments: Comment[];
}
```

### Checks & CI

```typescript
export type CheckStatus = 'queued' | 'in_progress' | 'completed';
export type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | 'skipped'
  | 'stale';

export interface CheckRun {
  id: number;
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion | null;
  startedAt?: Date;
  completedAt?: Date;

  // Details
  detailsUrl?: string;
  externalId?: string;

  // Output
  output?: {
    title?: string;
    summary?: string;
    text?: string;
    annotationsCount: number;
  };

  // App info (which GitHub App created this)
  app: {
    id: number;
    slug: string;
    name: string;
  };
}

export interface CheckSuite {
  id: number;
  headSha: string;
  status: CheckStatus;
  conclusion: CheckConclusion | null;

  // Summary
  checkRuns: CheckRun[];

  // Computed
  passed: number;
  failed: number;
  pending: number;
  total: number;
}

/**
 * Aggregated check status for a PR.
 */
export interface CheckSummary {
  state: 'pending' | 'success' | 'failure' | 'neutral';
  total: number;
  passed: number;
  failed: number;
  pending: number;
  runs: CheckRun[];

  // Computed
  allPassed: boolean;
  hasFailures: boolean;
  isComplete: boolean;
}
```

### Workflow Runs (GitHub Actions)

```typescript
export interface WorkflowRun {
  id: number;
  name: string;
  workflowId: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: CheckConclusion | null;

  headSha: string;
  headBranch: string;

  event: string; // 'push', 'pull_request', etc.

  runNumber: number;
  runAttempt: number;

  createdAt: Date;
  updatedAt: Date;

  jobs: WorkflowJob[];

  // URLs
  url: string;
  logsUrl: string;
  artifactsUrl: string;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion | null;
  startedAt?: Date;
  completedAt?: Date;

  steps: WorkflowStep[];

  // Runner info
  runnerName?: string;
  runnerGroupName?: string;
}

export interface WorkflowStep {
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion | null;
  number: number;
  startedAt?: Date;
  completedAt?: Date;
}
```

### Files Changed

```typescript
export interface FileChange {
  filename: string;
  status:
    | 'added'
    | 'removed'
    | 'modified'
    | 'renamed'
    | 'copied'
    | 'changed'
    | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string; // For renamed files
  blobUrl: string;
  rawUrl: string;
  contentsUrl: string;
}
```

### PR Snapshot

```typescript
export interface PRSnapshot {
  readonly pr: PRResource;
  readonly comments: readonly Comment[];
  readonly reviews: readonly Review[];
  readonly checks: CheckSummary;
  readonly files: readonly FileChange[];

  // Computed analytics
  readonly insights: PRInsights;

  // Serialization
  toJSON(): SerializedPRSnapshot;
  toMarkdown(): string;
}

export interface PRInsights {
  readonly approvalCount: number;
  readonly changesRequestedCount: number;
  readonly commentCount: number;
  readonly unresolvedThreads: number;
  readonly ciPassRate: number; // 0-1
  readonly averageReviewTime?: number; // ms from request to review
  readonly isReadyToMerge: boolean;
}

export interface SerializedPRSnapshot {
  pr: PRResource;
  comments: Comment[];
  reviews: Review[];
  checks: CheckSummary;
  files: FileChange[];
  insights: {
    approvalCount: number;
    changesRequestedCount: number;
    commentCount: number;
    unresolvedThreads: number;
    ciPassRate: number;
    isReadyToMerge: boolean;
  };
  fetchedAt: string;
}
```

### PR Events (Discriminated Union)

```typescript
/**
 * Discriminated union of all PR-related events for the stream.
 */
export type PREvent =
  | { type: 'prUpdated'; pr: PRResource }
  | { type: 'commentAdded'; comment: Comment }
  | { type: 'commentUpdated'; comment: Comment }
  | { type: 'commentDeleted'; commentId: number }
  | { type: 'reviewSubmitted'; review: Review }
  | { type: 'reviewDismissed'; reviewId: number }
  | { type: 'checkUpdated'; check: CheckRun }
  | { type: 'checkSuiteCompleted'; summary: CheckSummary }
  | { type: 'labelAdded'; label: Label }
  | { type: 'labelRemoved'; label: Label }
  | { type: 'merged'; mergeCommitSha: string }
  | { type: 'closed' }
  | { type: 'reopened' };
```

---

## Client Interfaces

### CommentClient

```typescript
/**
 * Client for managing PR comments.
 * Follows the ActivityClient pattern (cold/hot/hybrid streams).
 */
export interface CommentClient {
  /**
   * COLD STREAM: Yields all cached comments.
   */
  history(): AsyncIterable<Comment>;

  /**
   * HOT STREAM: Yields new comments as they arrive.
   */
  updates(): AsyncIterable<Comment>;

  /**
   * HYBRID STREAM: History then updates.
   */
  stream(): AsyncIterable<Comment>;

  /**
   * Add a new comment to the PR.
   */
  add(body: string): Promise<Comment>;

  /**
   * Reply to an existing comment.
   */
  reply(commentId: number, body: string): Promise<Comment>;

  /**
   * Edit an existing comment (must be author).
   */
  edit(commentId: number, body: string): Promise<Comment>;

  /**
   * Delete a comment (must be author or have permissions).
   */
  delete(commentId: number): Promise<void>;

  /**
   * Add a line comment on a specific file/line.
   */
  addLine(options: {
    body: string;
    path: string;
    line: number;
    side?: 'LEFT' | 'RIGHT';
    commitId?: string;
  }): Promise<Comment>;
}
```

### ReviewClient

```typescript
/**
 * Client for managing PR reviews.
 */
export interface ReviewClient {
  /**
   * COLD STREAM: Yields all reviews from cache.
   */
  history(): AsyncIterable<Review>;

  /**
   * HOT STREAM: Yields new reviews as they arrive.
   */
  updates(): AsyncIterable<Review>;

  /**
   * HYBRID STREAM: History then updates.
   */
  stream(): AsyncIterable<Review>;

  /**
   * Request a review from specified users.
   */
  request(users: string[]): Promise<void>;

  /**
   * Submit a review.
   */
  submit(options: {
    body: string;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: Array<{
      path: string;
      line: number;
      body: string;
      side?: 'LEFT' | 'RIGHT';
    }>;
  }): Promise<Review>;

  /**
   * Dismiss a review (requires admin/maintainer).
   */
  dismiss(reviewId: number, message: string): Promise<void>;
}
```

### CheckClient

```typescript
/**
 * Client for managing CI checks and GitHub Actions.
 */
export interface CheckClient {
  /**
   * Get current check summary.
   */
  summary(): Promise<CheckSummary>;

  /**
   * List all check runs for the PR's head commit.
   */
  list(): Promise<CheckRun[]>;

  /**
   * HOT STREAM: Watch for check status changes.
   */
  stream(): AsyncIterable<CheckRun>;

  /**
   * Block until all checks complete.
   * @param timeoutMs Maximum time to wait (default: 30 minutes)
   */
  waitForAll(timeoutMs?: number): Promise<CheckSummary>;

  /**
   * Re-run failed checks.
   */
  rerunFailed(): Promise<void>;

  /**
   * Re-run all checks.
   */
  rerunAll(): Promise<void>;

  /**
   * Get a specific check run by ID.
   */
  get(checkRunId: number): Promise<CheckRun>;

  /**
   * Get annotations for a check run (lint errors, test failures, etc.)
   */
  annotations(checkRunId: number): Promise<CheckAnnotation[]>;
}

export interface CheckAnnotation {
  path: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  level: 'notice' | 'warning' | 'failure';
  message: string;
  title?: string;
  rawDetails?: string;
}
```

### ActionsClient

```typescript
/**
 * Client for GitHub Actions workflow runs.
 */
export interface ActionsClient {
  /**
   * List workflow runs for the PR.
   */
  runs(): Promise<WorkflowRun[]>;

  /**
   * Get a specific workflow run.
   */
  run(runId: number): Promise<WorkflowRun>;

  /**
   * Get logs for a workflow run.
   */
  logs(runId: number): Promise<string>;

  /**
   * Get logs for a specific job.
   */
  jobLogs(jobId: number): Promise<string>;

  /**
   * List artifacts for a workflow run.
   */
  artifacts(runId: number): Promise<Artifact[]>;

  /**
   * Download an artifact.
   */
  downloadArtifact(artifactId: number): Promise<Buffer>;

  /**
   * Cancel a running workflow.
   */
  cancel(runId: number): Promise<void>;

  /**
   * Re-run a workflow.
   */
  rerun(runId: number): Promise<void>;
}

export interface Artifact {
  id: number;
  name: string;
  sizeInBytes: number;
  expired: boolean;
  createdAt: Date;
  expiresAt: Date;
  downloadUrl: string;
}
```

### FilesClient

```typescript
/**
 * Client for viewing files changed in a PR.
 */
export interface FilesClient {
  /**
   * List all files changed in the PR.
   */
  list(): Promise<FileChange[]>;

  /**
   * Get the diff/patch for the entire PR.
   */
  diff(): Promise<string>;

  /**
   * Get contents of a specific file at the PR's head.
   */
  content(path: string): Promise<string>;

  /**
   * Get contents of a file at a specific commit.
   */
  contentAt(path: string, commitSha: string): Promise<string>;
}
```

### PRClient (Main Interface)

```typescript
/**
 * Main interface for interacting with a GitHub Pull Request.
 * This is the primary abstraction for PR operations.
 */
export interface PRClient {
  // Identity
  readonly owner: string;
  readonly repo: string;
  readonly number: number;

  /**
   * Optional link to the Jules session that created this PR.
   */
  readonly sessionId?: string;

  // Sub-clients (scoped access)
  readonly comments: CommentClient;
  readonly reviews: ReviewClient;
  readonly checks: CheckClient;
  readonly actions: ActionsClient;
  readonly files: FilesClient;

  // Core operations

  /**
   * Get the current PR metadata.
   * Implements read-through caching.
   */
  info(): Promise<PRResource>;

  /**
   * Create a point-in-time snapshot with all data loaded.
   */
  snapshot(): Promise<PRSnapshot>;

  /**
   * Update PR metadata (title, body, labels, etc.)
   */
  update(changes: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
    milestone?: number | null;
    draft?: boolean;
  }): Promise<PRResource>;

  /**
   * Merge the PR.
   */
  merge(options?: {
    commitTitle?: string;
    commitMessage?: string;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    sha?: string; // HEAD SHA for optimistic locking
  }): Promise<{
    sha: string;
    merged: boolean;
    message: string;
  }>;

  /**
   * Close the PR without merging.
   */
  close(): Promise<PRResource>;

  /**
   * Reopen a closed PR.
   */
  reopen(): Promise<PRResource>;

  /**
   * Convert to/from draft.
   */
  setDraft(draft: boolean): Promise<PRResource>;

  /**
   * Watch for any changes to the PR (comments, reviews, checks, updates).
   */
  stream(): AsyncIterable<PREvent>;
}
```

---

## Storage & Caching Architecture

Following the existing Iceberg caching pattern from modjules.

### Storage Interfaces

```typescript
/**
 * Storage for PR metadata.
 */
export interface PRStorage {
  init(): Promise<void>;

  /**
   * Get cached PR data.
   */
  get(
    owner: string,
    repo: string,
    number: number,
  ): Promise<CachedPR | undefined>;

  /**
   * Store PR data.
   */
  upsert(pr: PRResource): Promise<void>;

  /**
   * Delete cached PR.
   */
  delete(owner: string, repo: string, number: number): Promise<void>;
}

export interface CachedPR {
  resource: PRResource;
  _lastSyncedAt: number;
}

/**
 * Storage for PR comments (append-only log like activities).
 */
export interface CommentStorage {
  init(): Promise<void>;
  close(): Promise<void>;

  append(comment: Comment): Promise<void>;
  get(commentId: number): Promise<Comment | undefined>;
  latest(): Promise<Comment | undefined>;
  scan(): AsyncIterable<Comment>;
}

/**
 * Storage for reviews.
 */
export interface ReviewStorage {
  init(): Promise<void>;
  close(): Promise<void>;

  append(review: Review): Promise<void>;
  get(reviewId: number): Promise<Review | undefined>;
  latest(): Promise<Review | undefined>;
  scan(): AsyncIterable<Review>;
}

/**
 * Storage for check runs (more ephemeral, shorter cache).
 */
export interface CheckStorage {
  init(): Promise<void>;

  /**
   * Store check runs for a commit SHA.
   * Overwrites previous data for that SHA.
   */
  set(commitSha: string, checks: CheckRun[]): Promise<void>;

  /**
   * Get cached checks for a commit SHA.
   */
  get(
    commitSha: string,
  ): Promise<{ checks: CheckRun[]; cachedAt: number } | undefined>;

  /**
   * Clear old cached checks (garbage collection).
   */
  prune(maxAgeMs: number): Promise<number>;
}
```

### File Structure

```
.jules/cache/
├── sessions/...              # Existing session cache
└── github/
    └── {owner}/
        └── {repo}/
            └── pulls/
                └── {number}/
                    ├── pr.json           # PRResource + _lastSyncedAt
                    ├── comments.jsonl    # Append-only comment log
                    ├── reviews.jsonl     # Append-only review log
                    └── checks/
                        └── {commitSha}.json  # Check runs for commit
```

### Caching Strategy

```typescript
/**
 * Iceberg-style cache validity for PRs.
 *
 * TIER 1 (HOT): Open PRs, recently updated
 *   → Always fetch from network, update cache
 *
 * TIER 2 (WARM): Merged PRs < 24 hours old
 *   → Use cache if fresh, background refresh
 *
 * TIER 3 (FROZEN): Merged/Closed PRs > 24 hours
 *   → Use cache, never refetch
 */
export function isPRCacheValid(cached: CachedPR | undefined): boolean {
  if (!cached) return false;

  const now = Date.now();
  const age = now - cached._lastSyncedAt;
  const pr = cached.resource;

  // FROZEN: Merged PRs older than 24 hours never change
  if (pr.merged && pr.mergedAt) {
    const timeSinceMerge = now - new Date(pr.mergedAt).getTime();
    if (timeSinceMerge > 24 * 60 * 60 * 1000) {
      return true; // Always valid
    }
  }

  // FROZEN: Closed (not merged) PRs older than 7 days
  if (pr.state === 'closed' && !pr.merged && pr.closedAt) {
    const timeSinceClose = now - new Date(pr.closedAt).getTime();
    if (timeSinceClose > 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
  }

  // WARM: Cache valid for 5 minutes for terminal states
  if (pr.state === 'closed' || pr.merged) {
    return age < 5 * 60 * 1000;
  }

  // HOT: Open PRs - cache valid for 30 seconds only
  return age < 30 * 1000;
}

/**
 * Cache validity for check runs.
 * Checks are more volatile, especially during CI runs.
 */
export function isCheckCacheValid(
  cached: { checks: CheckRun[]; cachedAt: number } | undefined,
): boolean {
  if (!cached) return false;

  const age = Date.now() - cached.cachedAt;
  const allComplete = cached.checks.every((c) => c.status === 'completed');

  // If all checks are complete, cache for 5 minutes
  if (allComplete) {
    return age < 5 * 60 * 1000;
  }

  // If checks are still running, cache for only 10 seconds
  return age < 10 * 1000;
}
```

---

## Event Sourcing for Mutable GitHub Data

### The Problem: Mutable vs. Immutable

The modjules `Activity` caching works because of an immutability guarantee:

> "We only want events strictly NEWER than the last one we successfully stored."

This assumes that if you have `activity-123`, you never need to check `activity-123` again. Activities are **write-once**.

GitHub Check Runs work differently - they are **write-many**:

1. **T0**: Check `#555` is created (`status: queued`)
2. **T1**: Check `#555` updates (`status: in_progress`)
3. **T2**: Check `#555` updates (`status: completed`, `conclusion: success`)

If you cache the CheckRun object at **T0**, the cache is now valid but **stale**. The high-water mark pattern would skip this check forever.

### The Solution: State Changes as Events

To reuse the robust `AsyncIterable` and append-only storage machinery, we wrap GitHub updates into **synthetic immutable events**.

Instead of storing the `CheckRun` entity directly, we store the **observation of the CheckRun at a point in time**.

#### Event Types for Mutable Resources

```typescript
// =============================================================================
// src/github/events.ts - GitHub Event Types (Event Sourcing)
// =============================================================================

/**
 * Base structure for all GitHub events.
 * These are synthetic events created by observing GitHub state changes.
 */
interface BaseGitHubEvent {
  /**
   * Unique event ID (not the GitHub resource ID).
   * Format: `evt-{resourceType}-{resourceId}-{timestamp}`
   */
  id: string;

  /**
   * When this observation was made.
   */
  createTime: string;

  /**
   * The PR this event belongs to.
   */
  prRef: {
    owner: string;
    repo: string;
    number: number;
  };
}

/**
 * Emitted when a check run's status changes.
 */
export interface CheckRunUpdatedEvent extends BaseGitHubEvent {
  type: 'checkRunUpdated';

  /**
   * The GitHub check run ID.
   */
  checkRunId: number;

  /**
   * The check run name (e.g., "build", "test", "lint").
   */
  name: string;

  /**
   * Snapshot of the check run state at this moment.
   */
  snapshot: {
    status: CheckStatus;
    conclusion: CheckConclusion | null;
    startedAt?: string;
    completedAt?: string;
  };

  /**
   * What changed from the previous observation.
   */
  transition?: {
    from: { status: CheckStatus; conclusion: CheckConclusion | null };
    to: { status: CheckStatus; conclusion: CheckConclusion | null };
  };
}

/**
 * Emitted when a workflow run's status changes.
 */
export interface WorkflowRunUpdatedEvent extends BaseGitHubEvent {
  type: 'workflowRunUpdated';

  workflowRunId: number;
  workflowName: string;
  runNumber: number;
  runAttempt: number;

  snapshot: {
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: CheckConclusion | null;
  };
}

/**
 * Emitted when a PR's metadata changes.
 */
export interface PRUpdatedEvent extends BaseGitHubEvent {
  type: 'prUpdated';

  snapshot: {
    state: 'open' | 'closed';
    merged: boolean;
    draft: boolean;
    mergeable: boolean | null;
    title: string;
    updatedAt: string;
  };

  /**
   * Which fields changed.
   */
  changedFields: string[];
}

/**
 * All GitHub events as a discriminated union.
 */
export type GitHubEvent =
  | CheckRunUpdatedEvent
  | WorkflowRunUpdatedEvent
  | PRUpdatedEvent;
```

### The Reducer Pattern

The network layer polls GitHub and emits immutable events. The client layer "reduces" these events to compute current state.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub API     │────▶│  Network Adapter │────▶│  Event Storage  │
│  (Mutable)      │     │  (Diff & Emit)   │     │  (Append-Only)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Current State   │◀────│    Reducer      │
                        │  (Computed)      │     │  (Replay Events)│
                        └──────────────────┘     └─────────────────┘
```

### Storage Structure

```
.jules/cache/github/{owner}/{repo}/pulls/{number}/
├── pr.json                    # Latest PRResource (mutable, for quick reads)
├── events.jsonl               # Append-only event log (immutable)
├── comments.jsonl             # Comment events (mostly immutable)
├── reviews.jsonl              # Review events (mostly immutable)
└── state/
    └── checks.json            # Reduced current state (derived from events)
```

The `events.jsonl` file contains the audit trail:

```jsonl
{"id":"evt-check-123-1704067200000","type":"checkRunUpdated","checkRunId":123,"name":"build","snapshot":{"status":"queued","conclusion":null},"createTime":"2024-01-01T00:00:00Z"}
{"id":"evt-check-123-1704067260000","type":"checkRunUpdated","checkRunId":123,"name":"build","snapshot":{"status":"in_progress","conclusion":null},"createTime":"2024-01-01T00:01:00Z"}
{"id":"evt-check-123-1704067500000","type":"checkRunUpdated","checkRunId":123,"name":"build","snapshot":{"status":"completed","conclusion":"success"},"createTime":"2024-01-01T00:05:00Z"}
```

### Handling Re-runs

With the Event Sourcing approach, re-runs work naturally:

**Run 1 (Fails):**

```
Event A: checkRunId=555, status=in_progress
Event B: checkRunId=555, status=completed, conclusion=failure
```

**User Clicks Re-run (GitHub creates new check run ID or resets):**

```
Event C: checkRunId=556, status=queued        # New ID from GitHub
Event D: checkRunId=556, status=in_progress
Event E: checkRunId=556, status=completed, conclusion=success
```

Because the high-water mark relies on `createTime`, Events C, D, E naturally flow through as "new updates." The reducer computes the latest state for each unique `checkRunId`.

### Implementation: CheckRunNetworkAdapter

```typescript
// =============================================================================
// src/github/network/checks.ts - Check Run Network Adapter
// =============================================================================

/**
 * Network adapter that polls GitHub for check run changes
 * and emits immutable events for each state transition.
 */
export class CheckRunNetworkAdapter {
  private cache = new Map<number, CheckRun>();

  constructor(
    private github: GitHubApiClient,
    private prRef: { owner: string; repo: string; number: number },
    private pollingIntervalMs: number,
  ) {}

  /**
   * Polls GitHub and yields events for any check run state changes.
   * This transforms mutable GitHub state into immutable events.
   */
  async *poll(): AsyncIterable<CheckRunUpdatedEvent> {
    while (true) {
      try {
        const currentChecks = await this.github.listCheckRuns(this.prRef);

        for (const check of currentChecks) {
          const known = this.cache.get(check.id);

          // Is it new? Or has it changed?
          const isNew = !known;
          const hasChanged =
            known &&
            (known.status !== check.status ||
              known.conclusion !== check.conclusion);

          if (isNew || hasChanged) {
            // 1. Build the transition info
            const transition = known
              ? {
                  from: { status: known.status, conclusion: known.conclusion },
                  to: { status: check.status, conclusion: check.conclusion },
                }
              : undefined;

            // 2. Update volatile cache to avoid duplicate emissions
            this.cache.set(check.id, check);

            // 3. Emit an IMMUTABLE event for the permanent log
            yield {
              id: `evt-check-${check.id}-${Date.now()}`,
              type: 'checkRunUpdated',
              createTime: new Date().toISOString(),
              prRef: this.prRef,
              checkRunId: check.id,
              name: check.name,
              snapshot: {
                status: check.status,
                conclusion: check.conclusion,
                startedAt: check.startedAt?.toISOString(),
                completedAt: check.completedAt?.toISOString(),
              },
              transition,
            };
          }
        }

        // Handle deleted/removed checks (rare but possible)
        for (const [id, cached] of this.cache) {
          if (!currentChecks.find((c) => c.id === id)) {
            this.cache.delete(id);
            // Optionally emit a "checkRunRemoved" event
          }
        }
      } catch (error) {
        // Log but don't crash the stream
        console.error('Check polling error:', error);
      }

      await sleep(this.pollingIntervalMs);
    }
  }
}
```

### Reducer: Computing Current State from Events

```typescript
// =============================================================================
// src/github/reducers/checks.ts - Check State Reducer
// =============================================================================

/**
 * Reduces a stream of check run events into current state.
 */
export function reduceCheckEvents(
  events: Iterable<CheckRunUpdatedEvent>,
): Map<number, CheckRun> {
  const state = new Map<number, CheckRun>();

  for (const event of events) {
    // Last-write-wins: later events overwrite earlier ones
    state.set(event.checkRunId, {
      id: event.checkRunId,
      name: event.name,
      status: event.snapshot.status,
      conclusion: event.snapshot.conclusion,
      startedAt: event.snapshot.startedAt
        ? new Date(event.snapshot.startedAt)
        : undefined,
      completedAt: event.snapshot.completedAt
        ? new Date(event.snapshot.completedAt)
        : undefined,
      // ... other fields from latest event
    } as CheckRun);
  }

  return state;
}

/**
 * Computes a CheckSummary from the reduced state.
 */
export function computeCheckSummary(
  checks: Map<number, CheckRun>,
): CheckSummary {
  const runs = Array.from(checks.values());

  const passed = runs.filter((r) => r.conclusion === 'success').length;
  const failed = runs.filter((r) => r.conclusion === 'failure').length;
  const pending = runs.filter((r) => r.status !== 'completed').length;

  return {
    state: failed > 0 ? 'failure' : pending > 0 ? 'pending' : 'success',
    total: runs.length,
    passed,
    failed,
    pending,
    runs,
    allPassed: failed === 0 && pending === 0,
    hasFailures: failed > 0,
    isComplete: pending === 0,
  };
}
```

### Updated Check Client with Event Sourcing

```typescript
// =============================================================================
// src/github/clients/checks.ts - Event-Sourced Check Client
// =============================================================================

export class EventSourcedCheckClient implements CheckClient {
  constructor(
    private eventStorage: GitHubEventStorage,
    private network: CheckRunNetworkAdapter,
    private prRef: { owner: string; repo: string; number: number },
  ) {}

  /**
   * COLD STREAM: Replay all check events from storage.
   */
  async *history(): AsyncIterable<CheckRunUpdatedEvent> {
    yield* this.eventStorage.scan('checkRunUpdated');
  }

  /**
   * HOT STREAM: Watch for new check events.
   */
  async *updates(): AsyncIterable<CheckRunUpdatedEvent> {
    await this.eventStorage.init();

    // Establish high-water mark from stored events
    const latest = await this.eventStorage.latest('checkRunUpdated');
    let highWaterMark = latest?.createTime
      ? new Date(latest.createTime).getTime()
      : 0;

    // Poll and emit new events
    for await (const event of this.network.poll()) {
      const eventTime = new Date(event.createTime).getTime();

      if (eventTime <= highWaterMark) continue;

      // Persist event to storage
      await this.eventStorage.append(event);
      highWaterMark = eventTime;

      yield event;
    }
  }

  /**
   * HYBRID STREAM: History then updates.
   */
  async *stream(): AsyncIterable<CheckRunUpdatedEvent> {
    yield* this.history();
    yield* this.updates();
  }

  /**
   * Get current check summary by reducing all events.
   */
  async summary(): Promise<CheckSummary> {
    const events: CheckRunUpdatedEvent[] = [];
    for await (const event of this.history()) {
      events.push(event);
    }

    const currentState = reduceCheckEvents(events);
    return computeCheckSummary(currentState);
  }

  /**
   * List current check runs (reduced from events).
   */
  async list(): Promise<CheckRun[]> {
    const events: CheckRunUpdatedEvent[] = [];
    for await (const event of this.history()) {
      events.push(event);
    }

    const currentState = reduceCheckEvents(events);
    return Array.from(currentState.values());
  }

  /**
   * Wait for all checks to complete.
   */
  async waitForAll(timeoutMs: number = 30 * 60 * 1000): Promise<CheckSummary> {
    const startTime = Date.now();

    for await (const event of this.stream()) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Timeout waiting for checks to complete');
      }

      // Reduce current state and check if complete
      const events: CheckRunUpdatedEvent[] = [];
      for await (const e of this.history()) {
        events.push(e);
      }

      const summary = computeCheckSummary(reduceCheckEvents(events));

      if (summary.isComplete) {
        return summary;
      }
    }

    throw new Error('Stream ended before checks completed');
  }

  // ... other methods
}
```

### Benefits of Event Sourcing

| Benefit             | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| **Audit Trail**     | Full history of check status changes, better than GitHub API provides |
| **Reuse Storage**   | Same append-only `ActivityStorage` pattern                            |
| **Offline Capable** | Can replay check history without network                              |
| **Natural Re-runs** | Multiple runs work automatically via unique event IDs                 |
| **Debugging**       | Can see exactly when checks transitioned states                       |
| **Time Travel**     | Can compute state at any point in time                                |

### When to Use Event Sourcing

| Resource Type | Mutability                         | Approach                           |
| ------------- | ---------------------------------- | ---------------------------------- |
| Comments      | Mostly immutable (can edit/delete) | Direct caching + soft invalidation |
| Reviews       | Immutable once submitted           | Direct caching                     |
| Check Runs    | Highly mutable                     | **Event Sourcing**                 |
| Workflow Runs | Highly mutable                     | **Event Sourcing**                 |
| PR Metadata   | Mutable                            | Event Sourcing or short TTL cache  |
| Files Changed | Immutable per commit               | Direct caching                     |

---

## Streaming Architecture

Following the existing cold/hot/hybrid pattern from modjules activities.

### Comment Client Implementation

```typescript
/**
 * Default implementation of CommentClient with streaming.
 */
export class DefaultCommentClient implements CommentClient {
  constructor(
    private storage: CommentStorage,
    private network: GitHubNetworkClient,
    private prRef: { owner: string; repo: string; number: number },
  ) {}

  /**
   * COLD STREAM: Yield all cached comments.
   */
  async *history(): AsyncIterable<Comment> {
    await this.storage.init();

    const hasCache = (await this.storage.latest()) !== undefined;

    if (!hasCache) {
      // Populate from network
      yield* this.fetchAndCacheAll();
      return;
    }

    yield* this.storage.scan();
  }

  private async *fetchAndCacheAll(): AsyncIterable<Comment> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.network.listComments({
        ...this.prRef,
        page,
        perPage: 100,
      });

      for (const comment of response.comments) {
        await this.storage.append(comment);
        yield comment;
      }

      hasMore = response.comments.length === 100;
      page++;
    }
  }

  /**
   * HOT STREAM: Poll for new comments.
   */
  async *updates(): AsyncIterable<Comment> {
    await this.storage.init();

    const latest = await this.storage.latest();
    let highWaterMark = latest?.createdAt
      ? new Date(latest.createdAt).getTime()
      : 0;
    let lastSeenId = latest?.id;

    while (true) {
      await this.network.sleep(this.network.pollingIntervalMs);

      // Fetch comments since high water mark
      const response = await this.network.listComments({
        ...this.prRef,
        since: new Date(highWaterMark).toISOString(),
      });

      for (const comment of response.comments) {
        const commentTime = new Date(comment.createdAt).getTime();

        if (commentTime < highWaterMark) continue;
        if (commentTime === highWaterMark && comment.id === lastSeenId)
          continue;

        await this.storage.append(comment);
        highWaterMark = commentTime;
        lastSeenId = comment.id;

        yield comment;
      }
    }
  }

  /**
   * HYBRID STREAM: History then updates.
   */
  async *stream(): AsyncIterable<Comment> {
    yield* this.history();
    yield* this.updates();
  }

  // ... mutation methods
}
```

### Unified PR Event Stream

```typescript
/**
 * Unified PR event stream that combines all sub-streams.
 */
export async function* streamPREvents(
  prClient: PRClient,
  pollingIntervalMs: number,
): AsyncIterable<PREvent> {
  // Use Promise.race pattern to multiplex multiple streams
  const commentStream = prClient.comments.updates();
  const reviewStream = prClient.reviews.updates();
  const checkStream = prClient.checks.stream();

  // Track iterators
  const iterators = new Map<string, AsyncIterator<any>>([
    ['comments', commentStream[Symbol.asyncIterator]()],
    ['reviews', reviewStream[Symbol.asyncIterator]()],
    ['checks', checkStream[Symbol.asyncIterator]()],
  ]);

  // Also poll for PR metadata changes
  let lastPRUpdate = Date.now();

  while (iterators.size > 0) {
    const promises: Promise<{ key: string; result: IteratorResult<any> }>[] =
      [];

    for (const [key, iterator] of iterators) {
      promises.push(iterator.next().then((result) => ({ key, result })));
    }

    // Add PR metadata poll
    promises.push(
      (async () => {
        await sleep(pollingIntervalMs);
        const pr = await prClient.info();
        return {
          key: 'pr',
          result: { done: false, value: pr },
        };
      })(),
    );

    const { key, result } = await Promise.race(promises);

    if (result.done) {
      iterators.delete(key);
      continue;
    }

    // Map to PREvent
    switch (key) {
      case 'comments':
        yield { type: 'commentAdded', comment: result.value };
        break;
      case 'reviews':
        yield { type: 'reviewSubmitted', review: result.value };
        break;
      case 'checks':
        yield { type: 'checkUpdated', check: result.value };
        break;
      case 'pr':
        if (new Date(result.value.updatedAt).getTime() > lastPRUpdate) {
          lastPRUpdate = new Date(result.value.updatedAt).getTime();
          yield { type: 'prUpdated', pr: result.value };
        }
        break;
    }
  }
}
```

---

## Integration with JulesClient

### Extended JulesOptions

```typescript
export interface JulesOptions {
  // ... existing options

  /**
   * Optional GitHub integration.
   * Enables PR enrichment and management for session outputs.
   */
  github?: GitHubConfig;
}
```

### Extended JulesClient

```typescript
export interface JulesClient {
  // ... existing methods

  /**
   * GitHub adapter for PR operations.
   * Only available if `github` config was provided.
   */
  readonly github?: GitHubAdapter;
}
```

### Extended SessionClient

```typescript
export interface SessionClient {
  // ... existing methods

  /**
   * Get the PR client for this session's pull request, if one exists.
   * Requires GitHub adapter to be configured.
   *
   * @returns PRClient if session has a PR output and GitHub is configured, null otherwise.
   *
   * @example
   * const session = await jules.session(...);
   * const pr = await session.pr();
   * if (pr) {
   *   const checks = await pr.checks.summary();
   *   if (checks.allPassed) {
   *     await pr.merge();
   *   }
   * }
   */
  pr(): Promise<PRClient | null>;
}
```

---

## MCP Tool Design

### GitHub MCP Tools

```typescript
export const githubTools = [
  // -------------------------------------------------------------------------
  // PR Information
  // -------------------------------------------------------------------------
  {
    name: 'github_get_pr',
    description:
      'Get details of a GitHub Pull Request including status, reviews, and checks.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        number: { type: 'number', description: 'PR number' },
        url: { type: 'string', description: 'Full GitHub PR URL' },
        sessionId: {
          type: 'string',
          description: 'Jules session ID to get its PR',
        },
      },
    },
  },

  {
    name: 'github_get_pr_snapshot',
    description:
      'Get a comprehensive snapshot of a PR with all comments, reviews, checks, and files.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------
  {
    name: 'github_list_pr_comments',
    description: 'List comments on a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        limit: {
          type: 'number',
          description: 'Max comments to return. Defaults to 20.',
        },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_add_pr_comment',
    description: 'Add a comment to a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        body: {
          type: 'string',
          description: 'The comment body (markdown supported)',
        },
      },
      required: ['owner', 'repo', 'number', 'body'],
    },
  },

  {
    name: 'github_add_line_comment',
    description: 'Add a comment on a specific line of code in a PR.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        body: { type: 'string' },
        path: {
          type: 'string',
          description: 'File path relative to repo root',
        },
        line: { type: 'number', description: 'Line number in the diff' },
        side: {
          type: 'string',
          enum: ['LEFT', 'RIGHT'],
          description: 'Side of diff. Defaults to RIGHT.',
        },
      },
      required: ['owner', 'repo', 'number', 'body', 'path', 'line'],
    },
  },

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------
  {
    name: 'github_list_pr_reviews',
    description: 'List reviews on a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_request_review',
    description: 'Request a review from specific users.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub usernames to request review from',
        },
      },
      required: ['owner', 'repo', 'number', 'reviewers'],
    },
  },

  {
    name: 'github_submit_review',
    description: 'Submit a review on a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        body: { type: 'string', description: 'Review summary' },
        event: {
          type: 'string',
          enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
          description: 'Review decision',
        },
      },
      required: ['owner', 'repo', 'number', 'event'],
    },
  },

  // -------------------------------------------------------------------------
  // Checks & CI
  // -------------------------------------------------------------------------
  {
    name: 'github_get_pr_checks',
    description: 'Get CI check status for a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_wait_for_checks',
    description: 'Wait for all CI checks to complete on a PR.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        timeoutMinutes: {
          type: 'number',
          description: 'Max wait time. Defaults to 30.',
        },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_rerun_checks',
    description: 'Re-run failed CI checks on a PR.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        runAll: {
          type: 'boolean',
          description: 'If true, rerun all checks. Otherwise only failed.',
        },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_get_workflow_logs',
    description: 'Get logs from a GitHub Actions workflow run.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        runId: { type: 'number', description: 'Workflow run ID' },
        jobName: {
          type: 'string',
          description: 'Optional: specific job to get logs for',
        },
      },
      required: ['owner', 'repo', 'runId'],
    },
  },

  // -------------------------------------------------------------------------
  // PR Management
  // -------------------------------------------------------------------------
  {
    name: 'github_update_pr',
    description: 'Update a pull request (title, body, labels, assignees).',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        assignees: { type: 'array', items: { type: 'string' } },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_merge_pr',
    description: 'Merge a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
        method: {
          type: 'string',
          enum: ['merge', 'squash', 'rebase'],
          description: 'Merge method. Defaults to merge.',
        },
        commitTitle: {
          type: 'string',
          description: 'Custom commit title for squash/merge',
        },
        commitMessage: { type: 'string', description: 'Custom commit message' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_close_pr',
    description: 'Close a pull request without merging.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------
  {
    name: 'github_list_pr_files',
    description: 'List files changed in a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  {
    name: 'github_get_pr_diff',
    description: 'Get the full diff/patch for a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },

  // -------------------------------------------------------------------------
  // Session Integration
  // -------------------------------------------------------------------------
  {
    name: 'github_pr_from_session',
    description: 'Get the PR associated with a Jules session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Jules session ID' },
      },
      required: ['sessionId'],
    },
  },
];
```

---

## Authentication Flow

### Authentication Strategies

```typescript
/**
 * Authentication strategies for GitHub API.
 */
export type GitHubAuth =
  | { type: 'token'; token: string }
  | { type: 'app'; appId: number; privateKey: string; installationId: number }
  | {
      type: 'oauth';
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    };

/**
 * Token provider interface for flexible auth.
 */
export interface TokenProvider {
  /**
   * Get a valid access token.
   * Implementations handle caching and refresh.
   */
  getToken(): Promise<string>;

  /**
   * Invalidate cached token (e.g., after 401).
   */
  invalidate(): void;
}
```

### Personal Access Token Provider

```typescript
/**
 * Simple PAT-based token provider.
 */
export class PersonalAccessTokenProvider implements TokenProvider {
  constructor(private token: string) {}

  async getToken(): Promise<string> {
    return this.token;
  }

  invalidate(): void {
    // PATs don't expire, nothing to do
  }
}
```

### GitHub App Token Provider

```typescript
/**
 * GitHub App installation token provider.
 * Handles JWT generation and installation token exchange.
 */
export class GitHubAppTokenProvider implements TokenProvider {
  private cachedToken?: { token: string; expiresAt: Date };

  constructor(
    private appId: number,
    private privateKey: string,
    private installationId: number,
    private platform: Platform,
  ) {}

  async getToken(): Promise<string> {
    // Check cache
    if (this.cachedToken && this.cachedToken.expiresAt > new Date()) {
      return this.cachedToken.token;
    }

    // Generate JWT
    const jwt = await this.generateJWT();

    // Exchange for installation token
    const response = await this.platform.fetch(
      `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get installation token: ${response.status}`);
    }

    const data = await response.json();

    this.cachedToken = {
      token: data.token,
      expiresAt: new Date(data.expires_at),
    };

    return this.cachedToken.token;
  }

  private async generateJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago (clock skew)
      exp: now + 10 * 60, // Expires in 10 minutes
      iss: this.appId,
    };

    // Sign with RS256
    return signJWT(payload, this.privateKey, this.platform);
  }

  invalidate(): void {
    this.cachedToken = undefined;
  }
}
```

### OAuth Token Provider

```typescript
/**
 * OAuth token provider with automatic refresh.
 */
export class OAuthTokenProvider implements TokenProvider {
  private cachedToken?: { token: string; expiresAt: Date };

  constructor(
    private clientId: string,
    private clientSecret: string,
    private refreshToken: string,
    private platform: Platform,
  ) {}

  async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > new Date()) {
      return this.cachedToken.token;
    }

    // Refresh the token
    const response = await this.platform.fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`OAuth refresh failed: ${response.status}`);
    }

    const data = await response.json();

    this.cachedToken = {
      token: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    // Update refresh token if rotated
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    return this.cachedToken.token;
  }

  invalidate(): void {
    this.cachedToken = undefined;
  }
}
```

---

## Error Handling

```typescript
export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: any,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string) {
    super(`GitHub resource not found: ${resource}`, 404);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(
    public readonly resetAt: Date,
    public readonly limit: number,
    public readonly remaining: number,
  ) {
    super(
      `GitHub rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      429,
    );
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubAuthError extends GitHubError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubPermissionError extends GitHubError {
  constructor(action: string, resource: string) {
    super(`Permission denied: cannot ${action} on ${resource}`, 403);
    this.name = 'GitHubPermissionError';
  }
}

export class GitHubMergeConflictError extends GitHubError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'GitHubMergeConflictError';
  }
}

export class GitHubValidationError extends GitHubError {
  constructor(
    message: string,
    public readonly errors: Array<{
      field: string;
      code: string;
      message: string;
    }>,
  ) {
    super(message, 422);
    this.name = 'GitHubValidationError';
  }
}
```

---

## Usage Examples

### Example 1: Full Session to PR to Merge Flow

```typescript
import { connect, github } from 'modjules';

const jules = connect({
  apiKey: process.env.JULES_API_KEY,
  github: github({
    token: process.env.GITHUB_TOKEN,
    pollingIntervalMs: 30_000,
  }),
});

async function automatedPRWorkflow() {
  // Create a Jules session with auto-PR enabled
  const session = await jules.session({
    prompt: 'Add input validation to the user registration form',
    source: { github: 'acme/webapp', branch: 'main' },
    autoPr: true,
    requireApproval: false,
  });

  console.log(`Session started: ${session.id}`);

  // Stream activity while Jules works
  for await (const activity of session.stream()) {
    if (activity.type === 'progressUpdated') {
      console.log(`Progress: ${activity.title}`);
    }
    if (activity.type === 'sessionCompleted') {
      console.log('Jules finished!');
      break;
    }
    if (activity.type === 'sessionFailed') {
      console.error(`Failed: ${activity.reason}`);
      return;
    }
  }

  // Get the PR that Jules created
  const pr = await session.pr();

  if (!pr) {
    console.log('No PR was created');
    return;
  }

  console.log(`PR created: ${pr.owner}/${pr.repo}#${pr.number}`);

  // Get PR details
  const info = await pr.info();
  console.log(`Title: ${info.title}`);
  console.log(`Files changed: ${info.changedFiles}`);
  console.log(`+${info.additions} -${info.deletions}`);

  // Wait for CI checks to complete
  console.log('Waiting for CI...');
  const checks = await pr.checks.waitForAll(10 * 60 * 1000); // 10 min timeout

  if (checks.hasFailures) {
    console.log('CI failed:');
    for (const run of checks.runs.filter((r) => r.conclusion === 'failure')) {
      console.log(`  - ${run.name}`);
    }
    return;
  }

  console.log('All checks passed!');

  // Check if we have approvals
  const reviews = [];
  for await (const review of pr.reviews.history()) {
    reviews.push(review);
  }

  const approvals = reviews.filter((r) => r.state === 'APPROVED');
  console.log(`Approvals: ${approvals.length}`);

  // Merge if ready
  if (checks.allPassed && approvals.length >= 1) {
    const result = await pr.merge({
      method: 'squash',
      commitTitle: `feat: ${info.title}`,
    });
    console.log(`Merged! Commit: ${result.sha}`);
  } else {
    console.log('Not ready to merge yet');
  }
}
```

### Example 2: Monitor an Existing PR

```typescript
async function monitorPR(owner: string, repo: string, number: number) {
  const pr = jules.github!.pr(owner, repo, number);

  // Get a full snapshot
  const snapshot = await pr.snapshot();

  console.log('=== PR Snapshot ===');
  console.log(
    `State: ${snapshot.pr.state} | Mergeable: ${snapshot.pr.mergeable}`,
  );
  console.log(
    `Reviews: ${snapshot.reviews.length} | Comments: ${snapshot.comments.length}`,
  );
  console.log(`CI: ${snapshot.checks.passed}/${snapshot.checks.total} passing`);
  console.log(`Ready to merge: ${snapshot.insights.isReadyToMerge}`);
  console.log('');
  console.log(snapshot.toMarkdown());

  // Stream real-time updates
  console.log('\nWatching for updates...');

  for await (const event of pr.stream()) {
    const timestamp = new Date().toISOString().slice(11, 19);

    switch (event.type) {
      case 'commentAdded':
        console.log(
          `[${timestamp}] Comment from ${event.comment.author.login}`,
        );
        break;

      case 'reviewSubmitted':
        console.log(
          `[${timestamp}] Review from ${event.review.author.login}: ${event.review.state}`,
        );
        break;

      case 'checkUpdated':
        console.log(
          `[${timestamp}] CI ${event.check.name}: ${event.check.status}`,
        );
        break;

      case 'checkSuiteCompleted':
        console.log(
          `[${timestamp}] All checks complete: ${event.summary.state}`,
        );
        break;

      case 'merged':
        console.log(`[${timestamp}] PR merged! ${event.mergeCommitSha}`);
        return;

      case 'closed':
        console.log(`[${timestamp}] PR closed without merging`);
        return;
    }
  }
}
```

### Example 3: Interactive Code Review Assistant

```typescript
async function codeReviewAssistant(prUrl: string) {
  const pr = jules.github!.pr(prUrl);
  const info = await pr.info();

  console.log(`Reviewing: ${info.title}`);

  // Get all changed files
  const files = await pr.files.list();

  console.log(`\nFiles changed (${files.length}):`);
  for (const file of files) {
    const icon =
      file.status === 'added' ? '+' : file.status === 'removed' ? '-' : '~';
    console.log(
      `  ${icon} ${file.filename} (+${file.additions}/-${file.deletions})`,
    );
  }

  // Get the full diff
  const diff = await pr.files.diff();

  // Read existing comments to avoid duplicates
  const existingComments = [];
  for await (const comment of pr.comments.history()) {
    existingComments.push(comment);
  }

  console.log(`\nExisting comments: ${existingComments.length}`);

  // Add a line comment on a specific file
  await pr.comments.addLine({
    body: 'Consider adding input validation here',
    path: 'src/components/Form.tsx',
    line: 42,
    side: 'RIGHT',
  });

  // Submit a review with multiple comments
  await pr.reviews.submit({
    body: 'Overall looks good! A few suggestions below.',
    event: 'COMMENT',
    comments: [
      {
        path: 'src/utils/validate.ts',
        line: 15,
        body: 'This regex could be simplified',
      },
      {
        path: 'src/api/handler.ts',
        line: 88,
        body: 'Should we add error handling here?',
      },
    ],
  });

  console.log('Review submitted!');
}
```

### Example 4: CI Failure Investigation

```typescript
async function investigateCIFailure(
  owner: string,
  repo: string,
  prNumber: number,
) {
  const pr = jules.github!.pr(owner, repo, prNumber);
  const checks = await pr.checks.summary();

  if (checks.allPassed) {
    console.log('All checks passing!');
    return;
  }

  console.log(`CI Status: ${checks.passed}/${checks.total} passing\n`);

  // Find failed checks
  const failedChecks = checks.runs.filter((r) => r.conclusion === 'failure');

  for (const check of failedChecks) {
    console.log(`Failed: ${check.name}`);
    console.log(`   Status: ${check.status} | Conclusion: ${check.conclusion}`);

    // Get annotations (lint errors, test failures, etc.)
    const annotations = await pr.checks.annotations(check.id);

    if (annotations.length > 0) {
      console.log('   Annotations:');
      for (const ann of annotations.slice(0, 5)) {
        console.log(`     ${ann.level}: ${ann.path}:${ann.startLine}`);
        console.log(`       ${ann.message}`);
      }
      if (annotations.length > 5) {
        console.log(`     ... and ${annotations.length - 5} more`);
      }
    }

    // If it's a GitHub Action, get the logs
    if (check.app.slug === 'github-actions' && check.detailsUrl) {
      const runIdMatch = check.detailsUrl.match(/runs\/(\d+)/);
      if (runIdMatch) {
        const runId = parseInt(runIdMatch[1]);

        console.log('   Fetching workflow logs...');
        const logs = await pr.actions.logs(runId);

        // Extract error lines
        const errorLines = logs
          .split('\n')
          .filter(
            (line) =>
              line.includes('error') ||
              line.includes('Error') ||
              line.includes('FAILED'),
          )
          .slice(0, 10);

        if (errorLines.length > 0) {
          console.log('   Error snippets from logs:');
          for (const line of errorLines) {
            console.log(`     ${line.trim().slice(0, 100)}`);
          }
        }
      }
    }

    console.log('');
  }

  // Offer to rerun failed checks
  console.log('Rerunning failed checks...');
  await pr.checks.rerunFailed();
  console.log('Rerun triggered!');
}
```

### Example 5: Batch PR Processing

```typescript
async function processDependabotPRs() {
  const dependabotPRs: Array<{ owner: string; repo: string; number: number }> =
    [];

  // Find all sessions that created dependabot-related PRs
  for await (const session of jules.sessions()) {
    if (
      session.title.includes('dependabot') ||
      session.title.includes('dependency')
    ) {
      const sessionClient = jules.session(session.id);
      const pr = await sessionClient.pr();

      if (pr) {
        const info = await pr.info();
        if (info.state === 'open' && info.author.login === 'dependabot[bot]') {
          dependabotPRs.push({
            owner: pr.owner,
            repo: pr.repo,
            number: pr.number,
          });
        }
      }
    }
  }

  console.log(`Found ${dependabotPRs.length} open Dependabot PRs`);

  // Process each PR
  for (const { owner, repo, number } of dependabotPRs) {
    const pr = jules.github!.pr(owner, repo, number);
    const info = await pr.info();
    const checks = await pr.checks.summary();

    console.log(`\n${owner}/${repo}#${number}: ${info.title}`);
    console.log(`  CI: ${checks.state} (${checks.passed}/${checks.total})`);

    if (checks.allPassed && info.mergeable) {
      console.log('  -> Auto-merging...');
      await pr.merge({ method: 'squash' });
      console.log('  Merged!');
    } else if (checks.hasFailures) {
      console.log('  -> CI failed, adding comment');
      await pr.comments.add(
        'This dependency update has failing CI checks. Please investigate.',
      );
    } else {
      console.log('  -> Not ready to merge');
    }
  }
}
```

### Example 6: PR Comments as a Conversation Stream

```typescript
async function prConversation(owner: string, repo: string, number: number) {
  const pr = jules.github!.pr(owner, repo, number);

  console.log('Loading conversation history...\n');

  // Show existing conversation
  for await (const comment of pr.comments.history()) {
    const time = new Date(comment.createdAt).toLocaleString();
    console.log(`[${time}] @${comment.author.login}:`);
    console.log(`  ${comment.body.split('\n').join('\n  ')}`);
    console.log('');
  }

  console.log('--- Watching for new comments ---\n');

  // Watch for new comments
  for await (const comment of pr.comments.updates()) {
    const time = new Date(comment.createdAt).toLocaleString();
    console.log(`[${time}] @${comment.author.login}:`);
    console.log(`  ${comment.body.split('\n').join('\n  ')}`);
    console.log('');

    // Auto-respond to certain keywords
    if (comment.body.toLowerCase().includes('@bot help')) {
      await pr.comments.reply(
        comment.id,
        'Hi! I can help with:\n' +
          '- `@bot status` - Check CI status\n' +
          '- `@bot merge` - Merge if ready\n' +
          '- `@bot rerun` - Rerun failed checks',
      );
    }

    if (comment.body.toLowerCase().includes('@bot status')) {
      const checks = await pr.checks.summary();
      await pr.comments.reply(
        comment.id,
        `CI Status: ${checks.state}\n` +
          `- Passed: ${checks.passed}\n` +
          `- Failed: ${checks.failed}\n` +
          `- Pending: ${checks.pending}`,
      );
    }

    if (comment.body.toLowerCase().includes('@bot merge')) {
      const checks = await pr.checks.summary();
      const info = await pr.info();

      if (checks.allPassed && info.mergeable) {
        await pr.comments.reply(comment.id, 'Merging now!');
        await pr.merge({ method: 'squash' });
      } else {
        await pr.comments.reply(
          comment.id,
          `Cannot merge yet:\n` +
            `- CI Passing: ${checks.allPassed}\n` +
            `- Mergeable: ${info.mergeable}`,
        );
      }
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Read-only PR enrichment

- `PRClient.info()` - basic metadata
- `PRClient.comments.history()` - fetch existing comments
- `PRClient.checks.list()` - current check status
- Session linkage: `session.pr()` returns PRClient

### Phase 2: PR management

- `pr.merge()`, `pr.close()`, `pr.update()`
- `pr.comments.add()`
- `pr.reviews.request()`

### Phase 3: Streaming & real-time

- `pr.checks.stream()` with polling
- Webhook adapter for real-time
- `pr.checks.waitForAll()` for blocking on CI

### Phase 4: Deep GitHub Actions integration

- Workflow run details
- Job logs
- Artifact downloads

---

## Summary

This design provides:

| Feature                 | Description                                                                      |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Main Abstraction**    | `GitHubAdapter` at the top level, `PRClient` as primary entity                   |
| **Consistent Patterns** | Cold/Hot/Hybrid streaming, Iceberg caching, discriminated unions                 |
| **Event Sourcing**      | Mutable GitHub data (checks, workflows) stored as immutable events with reducers |
| **MCP Integration**     | 15+ new tools for PR lifecycle operations                                        |
| **Flexible Auth**       | PAT, GitHub Apps, and OAuth flows                                                |
| **Extensibility**       | Clean extension points for GitLab/Bitbucket                                      |

### Key Architectural Decisions

1. **Event Sourcing for Mutable Data**: Check runs and workflow runs are stored as immutable events, enabling audit trails and the same append-only storage patterns used for activities.

2. **Reducer Pattern**: Current state is computed by replaying events, allowing time-travel debugging and offline capability.

3. **Hybrid Caching**:
   - Immutable resources (comments, reviews, files) use direct caching
   - Mutable resources (checks, workflows, PR metadata) use event sourcing
   - Terminal states (merged/closed PRs) are frozen and never refetched

4. **Session Linkage**: PRs created by Jules sessions are automatically linked, enabling `session.pr()` access.
