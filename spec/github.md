# GitHub Integration Specification

> **Status**: Proposed
> **Last Updated**: 2026-01-02
> **Purpose**: Define expected behavior for GitHub PR integration in the modjules SDK

---

## Overview

The GitHub integration provides PR management capabilities for Jules sessions. It enables tracking and managing Pull Requests created by Jules, with support for comments, reviews, CI checks, and GitHub Actions.

### Design Goals

1. **Session-PR Linkage**: Easy access to PRs created by Jules sessions
2. **Standalone PR Access**: Work with any GitHub PR, not just Jules-created ones
3. **Consistent Patterns**: Follow existing modjules patterns (cold/hot streaming, caching)
4. **Optional Integration**: Keep core SDK lean, GitHub is opt-in
5. **Event Sourcing**: Handle mutable GitHub data (checks, workflows) as immutable events

---

## Table of Contents

1. [GitHubAdapter](#1-githubadapter)
2. [PRClient](#2-prclient)
3. [CommentClient](#3-commentclient)
4. [ReviewClient](#4-reviewclient)
5. [CheckClient](#5-checkclient)
6. [ActionsClient](#6-actionsclient)
7. [FilesClient](#7-filesclient)
8. [Storage & Caching](#8-storage--caching)
9. [Event Sourcing](#9-event-sourcing)
10. [Session Integration](#10-session-integration)
11. [Authentication](#11-authentication)
12. [Error Handling](#12-error-handling)
13. [MCP Tools](#13-mcp-tools)
14. [Test Cases](#14-test-cases)

---

## 1. GitHubAdapter

The top-level abstraction that plugs into JulesClient.

### Function Signature

```typescript
interface GitHubConfig {
  token: string;
  baseUrl?: string; // Default: 'https://api.github.com'
  pollingIntervalMs?: number; // Default: 30000
  webhook?: {
    secret: string;
    callbackUrl?: string;
  };
}

interface GitHubAdapter {
  pr(repo: string, number: number): PRClient;
  pr(options: { owner: string; repo: string; number: number }): PRClient;
  pr(url: string): PRClient;
  parsePrUrl(
    url: string,
  ): { owner: string; repo: string; number: number } | null;
  viewer(): Promise<GitHubUser>;
  rateLimit(): Promise<RateLimitInfo>;
}

function github(config: GitHubConfig): GitHubAdapter;
```

### Core Behaviors

| ID    | Behavior                                               | Status  |
| ----- | ------------------------------------------------------ | ------- |
| GH-01 | `github()` factory creates GitHubAdapter with config   | pending |
| GH-02 | `pr(repo, number)` returns PRClient for `owner/repo#N` | pending |
| GH-03 | `pr(url)` parses GitHub URL and returns PRClient       | pending |
| GH-04 | `pr(options)` accepts explicit owner/repo/number       | pending |
| GH-05 | `parsePrUrl()` extracts owner/repo/number from URL     | pending |
| GH-06 | `parsePrUrl()` returns null for invalid URLs           | pending |
| GH-07 | `viewer()` returns authenticated user info             | pending |
| GH-08 | `rateLimit()` returns current rate limit status        | pending |
| GH-09 | Adapter respects `baseUrl` for GitHub Enterprise       | pending |
| GH-10 | Default polling interval is 30 seconds                 | pending |

### URL Parsing

| Input URL                                        | Expected Result                                   |
| ------------------------------------------------ | ------------------------------------------------- |
| `https://github.com/owner/repo/pull/123`         | `{ owner: 'owner', repo: 'repo', number: 123 }`   |
| `https://github.com/my-org/my-repo/pull/1`       | `{ owner: 'my-org', repo: 'my-repo', number: 1 }` |
| `https://github.enterprise.com/org/repo/pull/42` | `null` (different host without baseUrl)           |
| `https://github.com/owner/repo`                  | `null` (not a PR URL)                             |
| `invalid-url`                                    | `null`                                            |

---

## 2. PRClient

The primary entity for interacting with a GitHub Pull Request.

### Interface

```typescript
interface PRClient {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly sessionId?: string;

  // Sub-clients
  readonly comments: CommentClient;
  readonly reviews: ReviewClient;
  readonly checks: CheckClient;
  readonly actions: ActionsClient;
  readonly files: FilesClient;

  // Core operations
  info(): Promise<PRResource>;
  snapshot(): Promise<PRSnapshot>;
  update(changes: PRUpdateInput): Promise<PRResource>;
  merge(options?: MergeOptions): Promise<MergeResult>;
  close(): Promise<PRResource>;
  reopen(): Promise<PRResource>;
  setDraft(draft: boolean): Promise<PRResource>;
  stream(): AsyncIterable<PREvent>;
}
```

### Core Behaviors

| ID    | Behavior                                                             | Status  |
| ----- | -------------------------------------------------------------------- | ------- |
| PR-01 | `info()` returns PRResource with all metadata                        | pending |
| PR-02 | `info()` implements read-through caching                             | pending |
| PR-03 | `snapshot()` returns all data (PR, comments, reviews, checks, files) | pending |
| PR-04 | `update()` modifies title, body, labels, assignees                   | pending |
| PR-05 | `merge()` merges the PR with specified method                        | pending |
| PR-06 | `merge()` supports 'merge', 'squash', 'rebase' methods               | pending |
| PR-07 | `merge()` throws if PR is not mergeable                              | pending |
| PR-08 | `close()` closes the PR without merging                              | pending |
| PR-09 | `reopen()` reopens a closed PR                                       | pending |
| PR-10 | `setDraft(true)` converts PR to draft                                | pending |
| PR-11 | `setDraft(false)` marks PR as ready for review                       | pending |
| PR-12 | `stream()` yields PREvents for all changes                           | pending |

### PRResource Type

```typescript
interface PRResource {
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
  requestedReviewers: GitHubUser[];
  labels: Label[];
  milestone?: Milestone;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
  julesSessionId?: string;
}
```

### PREvent Discriminated Union

| Event Type            | Payload                      | Trigger                 |
| --------------------- | ---------------------------- | ----------------------- |
| `prUpdated`           | `{ pr: PRResource }`         | PR metadata changed     |
| `commentAdded`        | `{ comment: Comment }`       | New comment             |
| `commentUpdated`      | `{ comment: Comment }`       | Comment edited          |
| `commentDeleted`      | `{ commentId: number }`      | Comment deleted         |
| `reviewSubmitted`     | `{ review: Review }`         | Review submitted        |
| `reviewDismissed`     | `{ reviewId: number }`       | Review dismissed        |
| `checkUpdated`        | `{ check: CheckRun }`        | Check status changed    |
| `checkSuiteCompleted` | `{ summary: CheckSummary }`  | All checks complete     |
| `labelAdded`          | `{ label: Label }`           | Label added             |
| `labelRemoved`        | `{ label: Label }`           | Label removed           |
| `merged`              | `{ mergeCommitSha: string }` | PR merged               |
| `closed`              | `{}`                         | PR closed without merge |
| `reopened`            | `{}`                         | PR reopened             |

---

## 3. CommentClient

Manages PR comments with cold/hot/hybrid streaming pattern.

### Interface

```typescript
interface CommentClient {
  history(): AsyncIterable<Comment>;
  updates(): AsyncIterable<Comment>;
  stream(): AsyncIterable<Comment>;
  add(body: string): Promise<Comment>;
  reply(commentId: number, body: string): Promise<Comment>;
  edit(commentId: number, body: string): Promise<Comment>;
  delete(commentId: number): Promise<void>;
  addLine(options: LineCommentInput): Promise<Comment>;
}
```

### Core Behaviors

| ID     | Behavior                                                  | Status  |
| ------ | --------------------------------------------------------- | ------- |
| CMT-01 | `history()` yields all cached comments (cold stream)      | pending |
| CMT-02 | `history()` fetches from network if cache empty           | pending |
| CMT-03 | `updates()` yields new comments from network (hot stream) | pending |
| CMT-04 | `updates()` uses high-water mark to avoid duplicates      | pending |
| CMT-05 | `stream()` yields history then updates (hybrid)           | pending |
| CMT-06 | `add()` creates issue comment on PR                       | pending |
| CMT-07 | `reply()` creates reply to existing comment               | pending |
| CMT-08 | `edit()` updates comment body (must be author)            | pending |
| CMT-09 | `delete()` removes comment (must be author or admin)      | pending |
| CMT-10 | `addLine()` creates review comment on specific line       | pending |
| CMT-11 | Comments are cached in append-only storage                | pending |

### Comment Type

```typescript
interface Comment {
  id: number;
  type: 'issue' | 'review' | 'line';
  body: string;
  author: GitHubUser;
  createdAt: Date;
  updatedAt: Date;
  path?: string; // For line comments
  line?: number; // For line comments
  side?: 'LEFT' | 'RIGHT'; // For line comments
  reviewId?: number; // For review comments
  inReplyToId?: number; // For reply comments
  reactions: ReactionSummary;
}
```

---

## 4. ReviewClient

Manages PR reviews with streaming pattern.

### Interface

```typescript
interface ReviewClient {
  history(): AsyncIterable<Review>;
  updates(): AsyncIterable<Review>;
  stream(): AsyncIterable<Review>;
  request(users: string[]): Promise<void>;
  submit(options: SubmitReviewInput): Promise<Review>;
  dismiss(reviewId: number, message: string): Promise<void>;
}
```

### Core Behaviors

| ID     | Behavior                                                       | Status  |
| ------ | -------------------------------------------------------------- | ------- |
| REV-01 | `history()` yields all cached reviews (cold stream)            | pending |
| REV-02 | `updates()` yields new reviews (hot stream)                    | pending |
| REV-03 | `stream()` yields history then updates (hybrid)                | pending |
| REV-04 | `request()` requests review from specified users               | pending |
| REV-05 | `submit()` submits review with APPROVE/REQUEST_CHANGES/COMMENT | pending |
| REV-06 | `submit()` can include inline comments                         | pending |
| REV-07 | `dismiss()` dismisses a review (requires permissions)          | pending |
| REV-08 | Reviews are immutable once submitted                           | pending |

### Review Type

```typescript
interface Review {
  id: number;
  state:
    | 'PENDING'
    | 'COMMENTED'
    | 'APPROVED'
    | 'CHANGES_REQUESTED'
    | 'DISMISSED';
  body: string;
  author: GitHubUser;
  submittedAt: Date;
  commitId: string;
  comments: Comment[];
}
```

---

## 5. CheckClient

Manages CI checks with event sourcing for mutable state.

### Interface

```typescript
interface CheckClient {
  summary(): Promise<CheckSummary>;
  list(): Promise<CheckRun[]>;
  stream(): AsyncIterable<CheckRunUpdatedEvent>;
  waitForAll(timeoutMs?: number): Promise<CheckSummary>;
  rerunFailed(): Promise<void>;
  rerunAll(): Promise<void>;
  get(checkRunId: number): Promise<CheckRun>;
  annotations(checkRunId: number): Promise<CheckAnnotation[]>;
}
```

### Core Behaviors

| ID     | Behavior                                                | Status  |
| ------ | ------------------------------------------------------- | ------- |
| CHK-01 | `summary()` returns aggregated check status             | pending |
| CHK-02 | `list()` returns all check runs for HEAD commit         | pending |
| CHK-03 | `stream()` yields CheckRunUpdatedEvents (event sourced) | pending |
| CHK-04 | `waitForAll()` blocks until all checks complete         | pending |
| CHK-05 | `waitForAll()` respects timeout parameter               | pending |
| CHK-06 | `waitForAll()` throws on timeout                        | pending |
| CHK-07 | `rerunFailed()` re-runs only failed checks              | pending |
| CHK-08 | `rerunAll()` re-runs all checks                         | pending |
| CHK-09 | `get()` returns specific check run by ID                | pending |
| CHK-10 | `annotations()` returns check annotations               | pending |
| CHK-11 | Check state changes are stored as immutable events      | pending |
| CHK-12 | Current state is computed by reducing events            | pending |

### CheckSummary Type

```typescript
interface CheckSummary {
  state: 'pending' | 'success' | 'failure' | 'neutral';
  total: number;
  passed: number;
  failed: number;
  pending: number;
  runs: CheckRun[];
  allPassed: boolean;
  hasFailures: boolean;
  isComplete: boolean;
}
```

### CheckRun Type

```typescript
interface CheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: CheckConclusion | null;
  startedAt?: Date;
  completedAt?: Date;
  detailsUrl?: string;
  externalId?: string;
  output?: CheckOutput;
  app: { id: number; slug: string; name: string };
}

type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | 'skipped'
  | 'stale';
```

---

## 6. ActionsClient

Manages GitHub Actions workflow runs.

### Interface

```typescript
interface ActionsClient {
  runs(): Promise<WorkflowRun[]>;
  run(runId: number): Promise<WorkflowRun>;
  logs(runId: number): Promise<string>;
  jobLogs(jobId: number): Promise<string>;
  artifacts(runId: number): Promise<Artifact[]>;
  downloadArtifact(artifactId: number): Promise<Buffer>;
  cancel(runId: number): Promise<void>;
  rerun(runId: number): Promise<void>;
}
```

### Core Behaviors

| ID     | Behavior                                          | Status  |
| ------ | ------------------------------------------------- | ------- |
| ACT-01 | `runs()` lists workflow runs for the PR           | pending |
| ACT-02 | `run()` returns specific workflow run details     | pending |
| ACT-03 | `logs()` returns full logs for a workflow run     | pending |
| ACT-04 | `jobLogs()` returns logs for a specific job       | pending |
| ACT-05 | `artifacts()` lists artifacts from a workflow run | pending |
| ACT-06 | `downloadArtifact()` downloads artifact as Buffer | pending |
| ACT-07 | `cancel()` cancels a running workflow             | pending |
| ACT-08 | `rerun()` triggers re-run of a workflow           | pending |

---

## 7. FilesClient

Views files changed in a PR.

### Interface

```typescript
interface FilesClient {
  list(): Promise<FileChange[]>;
  diff(): Promise<string>;
  content(path: string): Promise<string>;
  contentAt(path: string, commitSha: string): Promise<string>;
}
```

### Core Behaviors

| ID     | Behavior                                                 | Status  |
| ------ | -------------------------------------------------------- | ------- |
| FIL-01 | `list()` returns all files changed in PR                 | pending |
| FIL-02 | `diff()` returns unified diff for entire PR              | pending |
| FIL-03 | `content()` returns file content at PR HEAD              | pending |
| FIL-04 | `contentAt()` returns file content at specific commit    | pending |
| FIL-05 | Files changed are immutable per commit (directly cached) | pending |

### FileChange Type

```typescript
interface FileChange {
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
  previousFilename?: string;
  blobUrl: string;
  rawUrl: string;
  contentsUrl: string;
}
```

---

## 8. Storage & Caching

Follows the existing Iceberg caching pattern from modjules.

### Cache File Structure

```
.jules/cache/github/{owner}/{repo}/pulls/{number}/
├── pr.json           # PRResource + _lastSyncedAt
├── events.jsonl      # Append-only event log (Event Sourcing)
├── comments.jsonl    # Append-only comment log
├── reviews.jsonl     # Append-only review log
└── state/
    └── checks.json   # Reduced current state (derived from events)
```

### Cache Validity Rules

| ID     | Behavior                                                | Status  |
| ------ | ------------------------------------------------------- | ------- |
| CAC-01 | Open PRs: cache valid for 30 seconds (HOT tier)         | pending |
| CAC-02 | Merged PRs < 24h: cache valid for 5 minutes (WARM tier) | pending |
| CAC-03 | Merged PRs > 24h: cache never expires (FROZEN tier)     | pending |
| CAC-04 | Closed PRs > 7d: cache never expires (FROZEN tier)      | pending |
| CAC-05 | Checks in-progress: cache valid for 10 seconds          | pending |
| CAC-06 | Checks completed: cache valid for 5 minutes             | pending |

### Iceberg Tiers

| Tier   | PR State                    | Cache TTL  | Network Behavior              |
| ------ | --------------------------- | ---------- | ----------------------------- |
| HOT    | Open, recently updated      | 30 seconds | Always fetch, update cache    |
| WARM   | Merged/Closed < threshold   | 5 minutes  | Use cache, background refresh |
| FROZEN | Merged > 24h or Closed > 7d | Never      | Use cache, never refetch      |

---

## 9. Event Sourcing

Mutable GitHub resources (checks, workflows) are stored as immutable events.

### Problem Statement

Activities in modjules are write-once (immutable). GitHub CheckRuns are write-many (mutable):

1. **T0**: Check created with `status: queued`
2. **T1**: Check updates to `status: in_progress`
3. **T2**: Check updates to `status: completed, conclusion: success`

Traditional caching would miss these state transitions.

### Solution: State Changes as Events

| ID     | Behavior                                                          | Status  |
| ------ | ----------------------------------------------------------------- | ------- |
| EVT-01 | CheckRun state changes are stored as `CheckRunUpdatedEvent`       | pending |
| EVT-02 | WorkflowRun state changes are stored as `WorkflowRunUpdatedEvent` | pending |
| EVT-03 | Events are append-only (immutable once written)                   | pending |
| EVT-04 | Events have unique IDs: `evt-{type}-{resourceId}-{timestamp}`     | pending |
| EVT-05 | Events include snapshot of state at observation time              | pending |
| EVT-06 | Events include transition info (from/to states)                   | pending |
| EVT-07 | Current state is computed by reducing all events                  | pending |
| EVT-08 | Reducer uses last-write-wins for same resource ID                 | pending |
| EVT-09 | High-water mark pattern prevents duplicate events                 | pending |
| EVT-10 | Re-runs create new events with new check run IDs                  | pending |

### Event Types

```typescript
interface CheckRunUpdatedEvent {
  id: string; // evt-check-{checkRunId}-{timestamp}
  type: 'checkRunUpdated';
  createTime: string; // ISO timestamp
  prRef: { owner: string; repo: string; number: number };
  checkRunId: number;
  name: string;
  snapshot: {
    status: CheckStatus;
    conclusion: CheckConclusion | null;
    startedAt?: string;
    completedAt?: string;
  };
  transition?: {
    from: { status: CheckStatus; conclusion: CheckConclusion | null };
    to: { status: CheckStatus; conclusion: CheckConclusion | null };
  };
}

interface WorkflowRunUpdatedEvent {
  id: string;
  type: 'workflowRunUpdated';
  createTime: string;
  prRef: { owner: string; repo: string; number: number };
  workflowRunId: number;
  workflowName: string;
  runNumber: number;
  runAttempt: number;
  snapshot: {
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: CheckConclusion | null;
  };
}
```

### Reducer Pattern

```typescript
// Reduce events to current state
function reduceCheckEvents(
  events: CheckRunUpdatedEvent[],
): Map<number, CheckRun>;
function computeCheckSummary(checks: Map<number, CheckRun>): CheckSummary;
```

| ID     | Behavior                                             | Status  |
| ------ | ---------------------------------------------------- | ------- |
| RED-01 | Reducer iterates events in order                     | pending |
| RED-02 | Later events overwrite earlier for same checkRunId   | pending |
| RED-03 | `computeCheckSummary()` aggregates reduced state     | pending |
| RED-04 | `allPassed` = no failures and no pending             | pending |
| RED-05 | `hasFailures` = any check with `conclusion: failure` | pending |
| RED-06 | `isComplete` = no checks with `status !== completed` | pending |

---

## 10. Session Integration

PRs created by Jules sessions are automatically linked.

### Extended SessionClient

```typescript
interface SessionClient {
  // ... existing methods

  /**
   * Get the PR client for this session's pull request, if one exists.
   * Requires GitHub adapter to be configured.
   */
  pr(): Promise<PRClient | null>;
}
```

### Extended JulesClient

```typescript
interface JulesClient {
  // ... existing methods

  /**
   * GitHub adapter for PR operations.
   * Only available if `github` config was provided.
   */
  readonly github?: GitHubAdapter;
}

interface JulesOptions {
  // ... existing options
  github?: GitHubConfig;
}
```

### Behaviors

| ID     | Behavior                                                 | Status  |
| ------ | -------------------------------------------------------- | ------- |
| SES-01 | `session.pr()` returns PRClient if session has PR output | pending |
| SES-02 | `session.pr()` returns null if no PR output              | pending |
| SES-03 | `session.pr()` returns null if GitHub not configured     | pending |
| SES-04 | `jules.github` is undefined if not configured            | pending |
| SES-05 | PRClient from session has `sessionId` populated          | pending |
| SES-06 | PR URL is extracted from `session.outputs` array         | pending |

---

## 11. Authentication

Authentication uses Personal Access Tokens (PAT) for simplicity.

### Configuration

```typescript
interface GitHubConfig {
  /**
   * GitHub Personal Access Token.
   * Required scopes: repo, read:org (for org repos)
   */
  token: string;

  // ... other config options
}
```

### Behaviors

| ID      | Behavior                                   | Status  |
| ------- | ------------------------------------------ | ------- |
| AUTH-01 | Token is included in Authorization header  | pending |
| AUTH-02 | 401 response throws GitHubAuthError        | pending |
| AUTH-03 | Token is never logged or exposed in errors | pending |

---

## 12. Error Handling

Custom error types for GitHub API errors.

### Error Types

```typescript
class GitHubError extends Error {
  constructor(message: string, public status: number, public response?: any);
}

class GitHubNotFoundError extends GitHubError { status = 404; }
class GitHubRateLimitError extends GitHubError {
  status = 429;
  resetAt: Date;
  limit: number;
  remaining: number;
}
class GitHubAuthError extends GitHubError { status = 401; }
class GitHubPermissionError extends GitHubError { status = 403; }
class GitHubMergeConflictError extends GitHubError { status = 409; }
class GitHubValidationError extends GitHubError {
  status = 422;
  errors: Array<{ field: string; code: string; message: string }>;
}
```

### Behaviors

| ID     | Behavior                                                   | Status  |
| ------ | ---------------------------------------------------------- | ------- |
| ERR-01 | 404 response throws `GitHubNotFoundError`                  | pending |
| ERR-02 | 401 response throws `GitHubAuthError`                      | pending |
| ERR-03 | 403 response throws `GitHubPermissionError`                | pending |
| ERR-04 | 409 response throws `GitHubMergeConflictError`             | pending |
| ERR-05 | 422 response throws `GitHubValidationError` with errors    | pending |
| ERR-06 | 429 response throws `GitHubRateLimitError` with reset time | pending |
| ERR-07 | Rate limit error includes remaining/limit info             | pending |

---

## 13. MCP Tools

15+ MCP tools for GitHub operations.

### Tool List

| Tool Name                  | Description                                |
| -------------------------- | ------------------------------------------ |
| `github_get_pr`            | Get PR details by owner/repo/number or URL |
| `github_get_pr_snapshot`   | Get comprehensive PR snapshot              |
| `github_list_pr_comments`  | List PR comments                           |
| `github_add_pr_comment`    | Add a comment to PR                        |
| `github_add_line_comment`  | Add line comment on specific file/line     |
| `github_list_pr_reviews`   | List PR reviews                            |
| `github_request_review`    | Request review from users                  |
| `github_submit_review`     | Submit a review                            |
| `github_get_pr_checks`     | Get CI check status                        |
| `github_wait_for_checks`   | Wait for all checks to complete            |
| `github_rerun_checks`      | Re-run failed or all checks                |
| `github_get_workflow_logs` | Get workflow run logs                      |
| `github_update_pr`         | Update PR metadata                         |
| `github_merge_pr`          | Merge a PR                                 |
| `github_close_pr`          | Close PR without merging                   |
| `github_list_pr_files`     | List files changed in PR                   |
| `github_get_pr_diff`       | Get full diff/patch                        |
| `github_pr_from_session`   | Get PR associated with Jules session       |

### Behaviors

| ID     | Behavior                                                     | Status  |
| ------ | ------------------------------------------------------------ | ------- |
| MCP-01 | All GitHub tools return JSON in MCP format                   | pending |
| MCP-02 | Missing required args return error                           | pending |
| MCP-03 | `github_get_pr` accepts URL, owner/repo/number, or sessionId | pending |
| MCP-04 | `github_wait_for_checks` respects timeout parameter          | pending |
| MCP-05 | `github_merge_pr` supports merge/squash/rebase methods       | pending |
| MCP-06 | `github_pr_from_session` returns error if no PR              | pending |

---

## 14. Test Cases

See [spec/github/cases.yaml](./github/cases.yaml) for machine-readable test cases.

---

## Implementation Phases

### Phase 1: Read-only PR Enrichment

- `PRClient.info()` - basic metadata
- `PRClient.comments.history()` - fetch existing comments
- `PRClient.checks.list()` - current check status
- Session linkage: `session.pr()` returns PRClient

### Phase 2: PR Management

- `pr.merge()`, `pr.close()`, `pr.update()`
- `pr.comments.add()`
- `pr.reviews.request()`

### Phase 3: Streaming & Real-time

- `pr.checks.stream()` with polling
- Event sourcing for checks
- `pr.checks.waitForAll()` for blocking on CI

### Phase 4: Deep GitHub Actions Integration

- Workflow run details
- Job logs
- Artifact downloads
