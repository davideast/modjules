# jules.sync() Comprehensive Specification

> **Status**: Draft  
> **Last Updated**: 2026-01-01  
> **Purpose**: Define expected behavior for `jules.sync()` to enable exhaustive test generation

---

## Overview

The `sync()` method is the **Reconciliation Engine** for the Jules SDK. It synchronizes local cache state with the authoritative Jules API, enabling high-performance offline-first queries.

```typescript
sync(options?: SyncOptions): Promise<SyncStats>
```

---

## Table of Contents

1. [Function Signature](#1-function-signature)
2. [Core Behaviors](#2-core-behaviors)
3. [Rate Limiting & 429 Handling](#3-rate-limiting--429-handling)
4. [Error Handling](#4-error-handling)
5. [Hydration Behavior](#5-hydration-behavior-activity-ingestion)
6. [Progress Reporting](#6-progress-reporting)
7. [Edge Cases](#7-edge-cases)
8. [Test Cases](#8-test-cases)
9. [Production Requirements](#9-production-requirements)

---

## 1. Function Signature

### Input: `SyncOptions`

```typescript
interface SyncOptions {
  limit?: number; // Max sessions to ingest (default: 100)
  depth?: SyncDepth; // 'metadata' | 'activities' (default: 'metadata')
  incremental?: boolean; // Stop at high-water mark (default: true)
  concurrency?: number; // Parallel hydration jobs (default: 3)
  onProgress?: (progress: SyncProgress) => void;
}
```

### Output: `SyncStats`

```typescript
interface SyncStats {
  sessionsIngested: number;
  activitiesIngested: number;
  isComplete: boolean;
  durationMs: number;
}
```

### Progress Callback: `SyncProgress`

```typescript
interface SyncProgress {
  phase: 'fetching_list' | 'hydrating_records' | 'hydrating_activities';
  current: number;
  total?: number;
  lastIngestedId?: string;
  activityCount?: number;
}
```

---

## 2. Core Behaviors

### 2.1 High-Water Mark Detection

| ID     | Behavior                                                                        | Status         |
| ------ | ------------------------------------------------------------------------------- | -------------- |
| HWM-01 | When `incremental: true`, sync finds the newest `createTime` from local storage | ✅ Implemented |
| HWM-02 | When `incremental: false`, sync ignores local state and processes all sessions  | ✅ Implemented |
| HWM-03 | On cold start (empty cache), all fetched sessions are ingested                  | ✅ Implemented |
| HWM-04 | When a session's `createTime <= highWaterMark`, the iteration terminates        | ✅ Implemented |

#### Test Case: HWM-01

```
GIVEN: Local cache has session with createTime "2023-01-02T00:00:00Z"
AND: API returns sessions [Jan 3, Jan 2, Jan 1] (newest first)
WHEN: sync({ incremental: true })
THEN: Only Jan 3 is ingested (stops at Jan 2)
EXPECT: stats.sessionsIngested === 1
```

#### Test Case: HWM-02

```
GIVEN: Local cache has session with createTime "2023-01-02T00:00:00Z"
AND: API returns sessions [Jan 3, Jan 2, Jan 1]
WHEN: sync({ incremental: false })
THEN: All 3 sessions are ingested
EXPECT: stats.sessionsIngested === 3
```

#### Test Case: HWM-03

```
GIVEN: Local cache is empty
AND: API returns 5 sessions
WHEN: sync({ depth: 'metadata' })
THEN: All 5 sessions are ingested
EXPECT: stats.sessionsIngested === 5
```

---

### 2.2 Limit Enforcement

| ID     | Behavior                                              | Status         |
| ------ | ----------------------------------------------------- | -------------- |
| LIM-01 | `limit` caps the maximum number of sessions ingested  | ✅ Implemented |
| LIM-02 | Limit is enforced even when API returns more sessions | ✅ Implemented |
| LIM-03 | Default limit is 100 if not specified                 | ✅ Implemented |

#### Test Case: LIM-01

```
GIVEN: API returns 100 sessions
WHEN: sync({ limit: 10 })
THEN: Exactly 10 sessions are ingested
EXPECT: stats.sessionsIngested === 10
EXPECT: storage.upsert called 10 times
```

---

### 2.3 Depth Control

| ID     | Behavior                                                              | Status         |
| ------ | --------------------------------------------------------------------- | -------------- |
| DEP-01 | `depth: 'metadata'` only persists session resource data               | ✅ Implemented |
| DEP-02 | `depth: 'metadata'` does NOT call `session(id).history()`             | ✅ Implemented |
| DEP-03 | `depth: 'activities'` hydrates full activity history for each session | ✅ Implemented |
| DEP-04 | Default depth is `'metadata'`                                         | ✅ Implemented |
| DEP-05 | Activity count is correctly tracked in stats                          | ✅ Implemented |

#### Test Case: DEP-01

```
GIVEN: API returns 1 session
WHEN: sync({ depth: 'metadata' })
THEN: session().history() is NOT called
EXPECT: stats.activitiesIngested === 0
```

#### Test Case: DEP-03

```
GIVEN: API returns 1 session
AND: session has 5 activities
WHEN: sync({ depth: 'activities' })
THEN: session().history() is called once
EXPECT: stats.activitiesIngested === 5
```

---

### 2.4 Concurrency Control

| ID     | Behavior                                                           | Status         |
| ------ | ------------------------------------------------------------------ | -------------- |
| CON-01 | `concurrency` limits parallel hydration when `depth: 'activities'` | ✅ Implemented |
| CON-02 | Default concurrency is 3                                           | ✅ Implemented |
| CON-03 | `concurrency: 1` runs hydration sequentially                       | ✅ Implemented |
| CON-04 | Concurrency is enforced via `pMap` backpressure                    | ✅ Implemented |

#### Test Case: CON-03

```
GIVEN: 3 sessions, each hydration takes 100ms
WHEN: sync({ depth: 'activities', concurrency: 1 })
THEN: Total duration >= 300ms (sequential execution)
```

#### Test Case: CON-02

```
GIVEN: 6 sessions, each hydration takes 50ms
WHEN: sync({ depth: 'activities' }) // default concurrency: 3
THEN: At most 3 hydrations run at once
```

---

### 2.5 Persistence

| ID     | Behavior                                                                        | Status         |
| ------ | ------------------------------------------------------------------------------- | -------------- |
| PER-01 | Each session is persisted via `storage.upsert()`                                | ✅ Implemented |
| PER-02 | SessionCursor does NOT auto-persist (persist: false)                            | ✅ Implemented |
| PER-03 | Activities are persisted during hydration                                       | ✅ Implemented |
| PER-04 | No duplicate writes on subsequent syncs (high-water mark prevents re-ingestion) | ✅ Implemented |

#### Test Case: PER-04

```
GIVEN: Session 1 was synced previously
WHEN: sync() is called again
THEN: Session 1 is NOT written again
EXPECT: storage.upsert NOT called for session 1
```

---

### 2.6 Storage Structure

> [!NOTE]
> Data is stored in `.jules/cache/` relative to the project root (or configured `rootDir`).

#### 2.6.1 File Layout

```
.jules/
└── cache/
    ├── sessions.jsonl              # Session index (append-only, deduplicated on read)
    ├── <session-id>/
    │   ├── session.json            # Full session resource + sync metadata
    │   └── activities.jsonl        # Activity history (append-only)
    └── <session-id-2>/
        ├── session.json
        └── activities.jsonl
```

#### 2.6.2 File Formats

**`sessions.jsonl`** - Session Index

```json
{"id":"abc123","title":"Fix bug","state":"completed","createTime":"2023-01-01T00:00:00Z","source":"sources/github/owner/repo","_updatedAt":1704067200000}
{"id":"def456","title":"Add feature","state":"inProgress","createTime":"2023-01-02T00:00:00Z","source":"sources/github/owner/repo","_updatedAt":1704153600000}
```

**`<session-id>/session.json`** - Full Session Resource

```json
{
  "resource": {
    "id": "abc123",
    "name": "sessions/abc123",
    "createTime": "2023-01-01T00:00:00Z",
    "updateTime": "2023-01-01T01:00:00Z",
    "state": "completed",
    "title": "Fix bug",
    ...
  },
  "_lastSyncedAt": 1704067200000
}
```

**`<session-id>/activities.jsonl`** - Activity History

```json
{"id":"act-1","name":"activities/act-1","type":"thinking","createTime":"2023-01-01T00:01:00Z",...}
{"id":"act-2","name":"activities/act-2","type":"tool_call","createTime":"2023-01-01T00:02:00Z",...}
```

#### 2.6.3 Storage Behaviors

| ID      | Behavior                                               | Status         |
| ------- | ------------------------------------------------------ | -------------- |
| STOR-01 | Cache directory created at `.jules/cache/`             | ✅ Implemented |
| STOR-02 | Sessions written to `<session-id>/session.json`        | ✅ Implemented |
| STOR-03 | Session index appended to `sessions.jsonl`             | ✅ Implemented |
| STOR-04 | Activities appended to `<session-id>/activities.jsonl` | ✅ Implemented |
| STOR-05 | Index deduplicated on read (last entry wins)           | ✅ Implemented |
| STOR-06 | Corrupt JSON lines logged and skipped                  | ✅ Implemented |
| STOR-07 | Missing files handled gracefully (no crash)            | ✅ Implemented |

---

## 3. Rate Limiting & 429 Handling

> [!CAUTION]
> **Current behavior does NOT match expected behavior.** After exhausting retries, 429 errors propagate to the user.

### 3.1 Current Behavior (ApiClient Level)

| ID         | Behavior                                                 | Status         |
| ---------- | -------------------------------------------------------- | -------------- |
| RL-CURR-01 | 429 response triggers retry with exponential backoff     | ✅ Implemented |
| RL-CURR-02 | Backoff delays: 1s, 2s, 4s (doubling)                    | ✅ Implemented |
| RL-CURR-03 | Maximum 3 retries (4 total attempts)                     | ✅ Implemented |
| RL-CURR-04 | After 4 failed attempts, `JulesRateLimitError` is thrown | ✅ Implemented |
| RL-CURR-05 | `JulesRateLimitError` propagates to caller (sync throws) | ✅ Implemented |

#### Test Case: RL-CURR-02 (Current)

```
GIVEN: API returns 429 twice, then 200
WHEN: apiClient.request('sessions')
THEN: Request is retried with backoff (1s, 2s)
THEN: Successful response is returned
```

#### Test Case: RL-CURR-04 (Current)

```
GIVEN: API always returns 429
WHEN: apiClient.request('sessions')
THEN: After 4 attempts (1 + 3 retries), JulesRateLimitError is thrown
EXPECT: Error has status === 429
```

---

### 3.2 Expected Behavior (User Requirement)

> **Requirement**: "429 errors should be handled by backing off. Users should NOT see 429 errors—responses should just get slower."

| ID        | Behavior                                                      | Status             |
| --------- | ------------------------------------------------------------- | ------------------ |
| RL-EXP-01 | 429 handling should use unlimited retries with capped backoff | ❌ NOT Implemented |
| RL-EXP-02 | Backoff should cap at a maximum delay (e.g., 60s)             | ❌ NOT Implemented |
| RL-EXP-03 | Sync should NEVER throw `JulesRateLimitError`                 | ❌ NOT Implemented |
| RL-EXP-04 | Progress callback should indicate "rate limited" state        | ❌ NOT Implemented |
| RL-EXP-05 | Retry-After header should be respected if present             | ❌ NOT Implemented |

#### Test Case: RL-EXP-01 (Expected)

```
GIVEN: API returns 429 for first 10 requests, then 200
WHEN: sync()
THEN: Sync eventually succeeds (does NOT throw)
EXPECT: stats.sessionsIngested > 0
```

#### Test Case: RL-EXP-02 (Expected)

```
GIVEN: API returns 429 repeatedly
WHEN: Backoff delay is calculated
THEN: Delay increases exponentially but caps at MAX_BACKOFF (e.g., 60s)
EXPECT: delay <= 60000ms
```

#### Test Case: RL-EXP-03 (Expected)

```
GIVEN: API intermittently returns 429 during sync
WHEN: sync({ depth: 'activities' })
THEN: Each 429 triggers automatic retry with backoff
THEN: Sync completes without throwing
EXPECT: No JulesRateLimitError is thrown
```

---

### 3.3 Proposed 429 Handling Design

```typescript
// Constants
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 60000; // 1 minute
const BACKOFF_MULTIPLIER = 2;
const MAX_RETRIES = Infinity; // Never fail due to 429

// Logic
function calculateBackoff(attempt: number): number {
  const delay = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

// Retry-After header support
if (response.headers.has('Retry-After')) {
  const retryAfter = parseInt(response.headers.get('Retry-After')!, 10);
  delay = retryAfter * 1000; // Convert to ms
}
```

---

## 4. Error Handling

### 4.1 Recoverable Errors

| ID     | Error Type                | Expected Behavior                          | Status             |
| ------ | ------------------------- | ------------------------------------------ | ------------------ |
| ERR-01 | 429 Too Many Requests     | Retry with backoff (see §3)                | ⚠️ Partial         |
| ERR-02 | Network Timeout           | Retry once, then throw `JulesNetworkError` | ❌ NOT Implemented |
| ERR-03 | 500 Internal Server Error | Retry once with backoff, then throw        | ❌ NOT Implemented |

### 4.2 Non-Recoverable Errors

| ID     | Error Type       | Expected Behavior                            | Status         |
| ------ | ---------------- | -------------------------------------------- | -------------- |
| ERR-10 | 401 Unauthorized | Throw `JulesAuthenticationError` immediately | ✅ Implemented |
| ERR-11 | 403 Forbidden    | Throw `JulesAuthenticationError` immediately | ✅ Implemented |
| ERR-12 | Missing API Key  | Throw `MissingApiKeyError` immediately       | ✅ Implemented |

### 4.3 Partial Success Handling

| ID     | Behavior                                                        | Status             |
| ------ | --------------------------------------------------------------- | ------------------ |
| ERR-20 | If hydration fails for one session, other sessions remain valid | ⚠️ Partial         |
| ERR-21 | Stats should reflect partial progress before failure            | ❌ NOT Implemented |
| ERR-22 | Option: `continueOnError: true` to skip failed sessions         | ❌ NOT Implemented |

#### Test Case: ERR-20 (Partial Success)

```
GIVEN: 3 sessions to hydrate
AND: Session 3 hydration throws NetworkError
WHEN: sync({ depth: 'activities', concurrency: 1 })
THEN: Sessions 1 and 2 are fully hydrated before error is thrown
EXPECT: storage.upsert called for activities of sessions 1 and 2
```

---

## 5. Hydration Behavior (Activity Ingestion)

> [!IMPORTANT]
> This section addresses a critical gap: **partial hydration states** where syncs are interrupted or activities are added after initial sync. Naive implementations may skip downloading new data when local data exists.

### 5.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        sync({ depth: 'activities' })                │
├─────────────────────────────────────────────────────────────────────┤
│  1. Discover Sessions (SessionCursor)                               │
│     └─> For each session, check: should we hydrate?                 │
│                                                                     │
│  2. Hydration Decision (Per Session)                                │
│     ├─ NO local activities  → Full Hydration                        │
│     ├─ Some local activities → Incremental Hydration (gap fill)     │
│     └─ All activities synced → Skip                                 │
│                                                                     │
│  3. Activity Fetching (DefaultActivityClient)                       │
│     ├─ history()  → Returns cached OR fetches all                   │
│     └─ hydrate()  → Merges new activities into existing cache       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Current Hydration Logic

#### 5.2.1 Session-Level Decision (in `sync()`)

**Location**: [`src/client.ts#L167-L183`](file:///Users/davideast/Code/modjules/src/client.ts#L167-L183)

```typescript
if (depth === 'activities') {
  // Check if we have ANY activities locally
  const activityStorage = this.storageFactory.activity(session.id);
  let hasActivities = false;
  for await (const _ of activityStorage.scan()) {
    hasActivities = true;
    break; // Found at least one
  }

  if (!hasActivities) {
    shouldSkip = false; // Needs hydration
  }
}
```

| ID          | Current Behavior                                | Status         | Issue                  |
| ----------- | ----------------------------------------------- | -------------- | ---------------------- |
| HYD-CURR-01 | Check if ANY activities exist locally           | ✅ Implemented | Binary check only      |
| HYD-CURR-02 | If ≥1 activity exists, assume fully synced      | ⚠️ FLAWED      | Ignores partial states |
| HYD-CURR-03 | No comparison of local vs server activity count | ❌ Missing     | Can't detect gaps      |

---

#### 5.2.2 Activity-Level Fetching (in `DefaultActivityClient`)

**Location**: [`src/activities/client.ts`](file:///Users/davideast/Code/modjules/src/activities/client.ts)

| Method      | Behavior                                                                           | When Used             |
| ----------- | ---------------------------------------------------------------------------------- | --------------------- |
| `history()` | If cache empty → fetch all from network. If cache has data → yield from cache only | During sync hydration |
| `hydrate()` | Fetch all from network, merge into cache (skip existing IDs)                       | Manual call only      |
| `updates()` | Poll for new activities, append to cache                                           | Real-time streaming   |

---

### 5.3 Partial Hydration States

> [!CAUTION]
> **The current implementation cannot detect or recover from partial hydration states.**

#### 5.3.1 State Definitions

| State        | Description                                    | Detection                          | Recovery           |
| ------------ | ---------------------------------------------- | ---------------------------------- | ------------------ |
| **EMPTY**    | No local activities                            | `storage.latest() === undefined`   | Full fetch         |
| **PARTIAL**  | Some activities missing (interrupted sync)     | Local count < Server count         | ❌ Not implemented |
| **STALE**    | New activities exist on server since last sync | Server has newer than local latest | ❌ Not implemented |
| **COMPLETE** | All activities synced                          | Local latest = Server latest       | Skip hydration     |

#### 5.3.2 Partial State Scenarios

##### Scenario A: Interrupted Sync (Crash/Cancel)

```
Timeline:
  t0: sync() starts for session with 100 activities
  t1: 50 activities downloaded to disk
  t2: Process crashes / User cancels
  t3: sync() called again

CURRENT BEHAVIOR:
  - Sees hasActivities = true (50 exist)
  - Skips session entirely
  - Activities 51-100 are NEVER downloaded

EXPECTED BEHAVIOR:
  - Detects only 50 of 100 activities exist
  - Downloads remaining 50 activities
```

##### Scenario B: New Activities After Initial Sync

```
Timeline:
  t0: sync() downloads all 10 activities for session
  t1: User interacts with Jules, 5 new activities created
  t2: sync() called again

CURRENT BEHAVIOR:
  - Sees hasActivities = true
  - Skips session entirely
  - New 5 activities are NEVER downloaded

EXPECTED BEHAVIOR:
  - Detects local latest < server latest
  - Incrementally downloads only the 5 new activities
```

##### Scenario C: Gaps in Activity Stream

```
Timeline:
  t0: Activities 1-10 exist on server
  t1: Only activities 1, 3, 5, 7, 9 are downloaded (network issues)
  t2: sync() called again

CURRENT BEHAVIOR:
  - Sees hasActivities = true
  - Skips session entirely
  - Activities 2, 4, 6, 8, 10 are NEVER downloaded

EXPECTED BEHAVIOR:
  - Detects count mismatch (5 local vs 10 server)
  - Downloads missing activities
```

---

### 5.4 Expected Hydration Behavior

| ID         | Behavior                                                            | Status             | Priority |
| ---------- | ------------------------------------------------------------------- | ------------------ | -------- |
| HYD-EXP-01 | Track local activity count per session                              | ❌ NOT Implemented | P0       |
| HYD-EXP-02 | Fetch server activity count (or latest ID) for comparison           | ❌ NOT Implemented | P0       |
| HYD-EXP-03 | Detect PARTIAL state (local < server)                               | ❌ NOT Implemented | P0       |
| HYD-EXP-04 | Detect STALE state (server has newer)                               | ❌ NOT Implemented | P0       |
| HYD-EXP-05 | Incremental download: only fetch activities newer than local latest | ❌ NOT Implemented | P1       |
| HYD-EXP-06 | Gap filling: detect and fill missing activities                     | ❌ NOT Implemented | P2       |
| HYD-EXP-07 | Track hydration completeness in session metadata                    | ❌ NOT Implemented | P1       |
| HYD-EXP-08 | Resume interrupted hydration from checkpoint                        | ❌ NOT Implemented | P1       |

---

### 5.5 Proposed Hydration Design

#### 5.5.1 Enhanced Session Metadata

```typescript
// Store hydration state alongside session
interface HydrationMetadata {
  lastHydratedAt: number; // Epoch timestamp
  localActivityCount: number; // Count of activities in local storage
  serverActivityCountSnapshot?: number; // Last known server count
  lastActivityId?: string; // ID of latest local activity
  lastActivityTime?: string; // createTime of latest local activity
  isComplete: boolean; // True if fully hydrated
}
```

#### 5.5.2 Staleness Detection Algorithm

```typescript
async function isSessionStale(
  sessionId: string,
  storage: ActivityStorage,
  network: NetworkClient,
): Promise<{ stale: boolean; reason: 'partial' | 'new_activities' | null }> {
  // 1. Get local state
  const localLatest = await storage.latest();
  const localCount = await countActivities(storage);

  // 2. Get server state (lightweight HEAD-like call)
  const serverInfo = await network.getActivityInfo(sessionId);
  // Returns: { totalCount: number, latestActivityId: string, latestActivityTime: string }

  // 3. Compare
  if (localCount === 0) {
    return { stale: true, reason: null }; // Empty, needs full fetch
  }

  if (localCount < serverInfo.totalCount) {
    return { stale: true, reason: 'partial' }; // Interrupted sync
  }

  if (
    localLatest &&
    new Date(localLatest.createTime) < new Date(serverInfo.latestActivityTime)
  ) {
    return { stale: true, reason: 'new_activities' }; // New activities added
  }

  return { stale: false, reason: null }; // Fully synced
}
```

#### 5.5.3 Incremental Hydration

```typescript
async function* hydrateIncremental(
  sessionId: string,
  storage: ActivityStorage,
  network: NetworkClient,
): AsyncIterable<Activity> {
  const localLatest = await storage.latest();
  const highWaterMark = localLatest?.createTime
    ? new Date(localLatest.createTime).getTime()
    : 0;

  // Fetch activities from network, but only persist NEW ones
  let pageToken: string | undefined;

  do {
    const response = await network.listActivities({ pageToken });

    for (const activity of response.activities) {
      const actTime = new Date(activity.createTime).getTime();

      // Skip activities we already have
      if (actTime <= highWaterMark) {
        continue;
      }

      // Persist and yield new activity
      await storage.append(activity);
      yield activity;
    }

    pageToken = response.nextPageToken;
  } while (pageToken);
}
```

---

### 5.6 Test Cases: Partial Hydration

#### HYD-PARTIAL-01: Resume after interrupted sync

```typescript
{
  id: 'HYD-PARTIAL-01',
  description: 'Resume downloading activities after sync interruption',
  given: {
    session: { id: 'session-1', createTime: '2023-01-01T00:00:00Z' },
    localActivities: [
      { id: 'act-1', createTime: '2023-01-01T00:01:00Z' },
      { id: 'act-2', createTime: '2023-01-01T00:02:00Z' },
    ],
    serverActivities: [
      { id: 'act-1', createTime: '2023-01-01T00:01:00Z' },
      { id: 'act-2', createTime: '2023-01-01T00:02:00Z' },
      { id: 'act-3', createTime: '2023-01-01T00:03:00Z' },
      { id: 'act-4', createTime: '2023-01-01T00:04:00Z' },
    ],
    options: { depth: 'activities' }
  },
  when: 'sync() is called',
  then: {
    stats: { activitiesIngested: 2 }, // Only act-3 and act-4
    storage: {
      contains: ['act-1', 'act-2', 'act-3', 'act-4']
    }
  }
}
```

#### HYD-PARTIAL-02: Download new activities added after initial sync

```typescript
{
  id: 'HYD-PARTIAL-02',
  description: 'Incrementally download new activities',
  given: {
    session: { id: 'session-1', createTime: '2023-01-01T00:00:00Z' },
    localActivities: [
      { id: 'act-1', createTime: '2023-01-01T12:00:00Z' },
      { id: 'act-2', createTime: '2023-01-01T12:01:00Z' },
    ],
    // Simulate new activities created after last sync
    serverActivities: [
      { id: 'act-1', createTime: '2023-01-01T12:00:00Z' },
      { id: 'act-2', createTime: '2023-01-01T12:01:00Z' },
      { id: 'act-3', createTime: '2023-01-02T09:00:00Z' }, // NEW
    ],
    options: { depth: 'activities' }
  },
  when: 'sync() is called with incremental: true',
  then: {
    stats: { activitiesIngested: 1 }, // Only act-3
    calls: [
      { method: 'storage.append', args: { id: 'act-3' } }
    ]
  }
}
```

#### HYD-PARTIAL-03: Skip fully synced sessions

```typescript
{
  id: 'HYD-PARTIAL-03',
  description: 'Skip sessions with complete hydration',
  given: {
    session: { id: 'session-1' },
    localActivities: [
      { id: 'act-1', createTime: '2023-01-01T12:00:00Z' },
      { id: 'act-2', createTime: '2023-01-01T12:01:00Z' },
    ],
    serverActivities: [
      { id: 'act-1', createTime: '2023-01-01T12:00:00Z' },
      { id: 'act-2', createTime: '2023-01-01T12:01:00Z' },
    ], // Same as local
    options: { depth: 'activities' }
  },
  when: 'sync() is called',
  then: {
    stats: { activitiesIngested: 0 },
    calls: [
      { method: 'storage.append', times: 0 } // No writes
    ]
  }
}
```

#### HYD-PARTIAL-04: Detect interrupted sync via count mismatch

```typescript
{
  id: 'HYD-PARTIAL-04',
  description: 'Detect partial state when counts do not match',
  given: {
    session: { id: 'session-1' },
    localActivities: [{ id: 'act-1' }, { id: 'act-3' }, { id: 'act-5' }], // 3 activities
    serverActivityCount: 5, // 5 on server
  },
  when: 'isSessionStale() is called',
  then: {
    result: { stale: true, reason: 'partial' }
  }
}
```

#### HYD-PARTIAL-05: Handle empty cache correctly

```typescript
{
  id: 'HYD-PARTIAL-05',
  description: 'Full hydration when local cache is empty',
  given: {
    session: { id: 'session-1', createTime: '2023-01-01T00:00:00Z' },
    localActivities: [], // Empty
    serverActivities: [
      { id: 'act-1' },
      { id: 'act-2' },
      { id: 'act-3' },
    ],
    localSessionMeetsHighWaterMark: true, // Session itself exists locally
    options: { depth: 'activities', incremental: true }
  },
  when: 'sync() is called',
  then: {
    // CRITICAL: Even though session meets HWM, activities should be fetched
    stats: { activitiesIngested: 3 }
  }
}
```

---

### 5.7 Hydration Configuration Options

#### 5.7.1 Proposed New Options

```typescript
interface SyncOptions {
  // ... existing options ...

  /**
   * When true, forces re-checking all sessions for new activities,
   * even if the session itself was synced before.
   * @default false
   */
  forceHydrationCheck?: boolean;

  /**
   * Strategy for handling partial hydration states.
   * - 'resume': Continue from where we left off (default)
   * - 'refetch': Discard partial data and start fresh
   * - 'skip': Skip sessions with any local data (current behavior)
   * @default 'resume'
   */
  partialStrategy?: 'resume' | 'refetch' | 'skip';

  /**
   * Maximum age of hydration data before considered stale.
   * Sessions hydrated more than this many ms ago will be re-checked.
   * @default undefined (never stale based on time)
   */
  hydrationMaxAgeMs?: number;
}
```

---

### 5.8 Implementation Checklist

| Step | Description                                                                | Complexity |
| ---- | -------------------------------------------------------------------------- | ---------- |
| 1    | Add `activityCount` field to `SessionIndexEntry`                           | Low        |
| 2    | Track `lastActivityId` in session metadata                                 | Low        |
| 3    | Implement `network.getActivityInfo()` for lightweight staleness check      | Medium     |
| 4    | Modify `sync()` to use staleness detection instead of binary hasActivities | Medium     |
| 5    | Implement incremental hydration in `DefaultActivityClient`                 | Medium     |
| 6    | Add `partialStrategy` option handling                                      | Low        |
| 7    | Write comprehensive tests for all partial states                           | High       |

---

## 6. Progress Reporting

### 6.1 Progress Phases

| Phase                  | When Emitted                        | Fields                                                |
| ---------------------- | ----------------------------------- | ----------------------------------------------------- |
| `fetching_list`        | During session list fetching        | `current`, `lastIngestedId?`                          |
| `hydrating_records`    | Before/after each session hydration | `current`, `total`, `lastIngestedId?`                 |
| `hydrating_activities` | During activity streaming           | `current`, `total`, `lastIngestedId`, `activityCount` |

### 6.2 Progress Invariants

| ID     | Invariant                                              | Status         |
| ------ | ------------------------------------------------------ | -------------- |
| PRG-01 | `current` is monotonically increasing within a phase   | ✅ Implemented |
| PRG-02 | First callback has `current: 0`                        | ✅ Implemented |
| PRG-03 | `hydrating_records` includes `total` field             | ✅ Implemented |
| PRG-04 | Progress is emitted for each activity during hydration | ✅ Implemented |

#### Test Case: PRG-01

```
GIVEN: 3 sessions to hydrate
WHEN: sync({ depth: 'activities', onProgress })
THEN: onProgress receives hydrating_records with current: 1, 2, 3 (in order)
```

---

## 7. Edge Cases

### 7.1 Empty States

| ID      | Scenario                          | Expected Behavior                                       |
| ------- | --------------------------------- | ------------------------------------------------------- |
| EDGE-01 | API returns 0 sessions            | Return `{ sessionsIngested: 0, activitiesIngested: 0 }` |
| EDGE-02 | Session has 0 activities          | `activitiesIngested` for that session is 0              |
| EDGE-03 | Local cache is empty (cold start) | All sessions are ingested                               |

### 7.2 Boundary Conditions

| ID      | Scenario                                          | Expected Behavior                  |
| ------- | ------------------------------------------------- | ---------------------------------- |
| EDGE-10 | `limit: 0`                                        | Return immediately with 0 ingested |
| EDGE-11 | `limit: 1` with 100 sessions available            | Only 1 session ingested            |
| EDGE-12 | Session createTime equals high-water mark exactly | Session is NOT ingested (stops)    |

### 7.3 Race Conditions

| ID      | Scenario                         | Expected Behavior                                 |
| ------- | -------------------------------- | ------------------------------------------------- |
| EDGE-20 | Multiple concurrent sync() calls | Should use locking or dedupe                      |
| EDGE-21 | New session created during sync  | May or may not be included (eventual consistency) |

---

## 8. Test Cases

### 8.0 Spec-Driven Testing Architecture

> [!TIP]
> Test cases are defined in **machine-readable YAML** at [`spec/sync/cases.yaml`](file:///Users/davideast/Code/modjules/spec/sync/cases.yaml). A generic test runner at [`tests/sync/spec.test.ts`](file:///Users/davideast/Code/modjules/tests/sync/spec.test.ts) consumes the YAML and executes tests automatically.

```bash
# Run all spec tests
bun test tests/sync/spec.test.ts

# Run a specific test
bun test tests/sync/spec.test.ts --grep "HWM-01"
```

**Adding a new test case:**

1. Add a new entry to `spec/sync/cases.yaml` with `status: pending`
2. Implement the feature
3. Change status to `implemented`
4. Run tests to verify

**Test case structure:**

```yaml
- id: HWM-01
  description: Incremental sync stops at high-water mark
  category: high_water_mark
  status: implemented | pending | skipped
  priority: P0 | P1 | P2
  given:
    localSessions: [...] # Pre-existing local state
    apiSessions: [...] # API mock responses
    options: { ... } # SyncOptions
  when: sync
  then:
    stats: { sessionsIngested: 1 }
    calls: [{ method: 'storage.upsert', times: 1 }]
```

---

### 8.1 Test Case Summary Matrix

| Test ID        | Category                 | Priority | Status                         |
| -------------- | ------------------------ | -------- | ------------------------------ |
| HWM-01         | High-Water Mark          | P0       | ✅ Covered                     |
| HWM-02         | High-Water Mark          | P0       | ✅ Covered                     |
| HWM-03         | High-Water Mark          | P0       | ✅ Covered                     |
| LIM-01         | Limit Enforcement        | P0       | ✅ Covered                     |
| DEP-01         | Depth Control            | P0       | ✅ Covered                     |
| DEP-03         | Depth Control            | P0       | ✅ Covered                     |
| CON-03         | Concurrency              | P1       | ✅ Covered                     |
| PER-04         | Persistence              | P0       | ✅ Covered                     |
| RL-CURR-02     | Rate Limiting            | P0       | ⏭️ Skipped (api-retry.test.ts) |
| RL-CURR-04     | Rate Limiting            | P0       | ⏭️ Skipped (api-retry.test.ts) |
| RL-EXP-01      | Rate Limiting (Expected) | P0       | ❌ Missing                     |
| RL-EXP-02      | Rate Limiting (Expected) | P1       | ❌ Missing                     |
| RL-EXP-03      | Rate Limiting (Expected) | P0       | ❌ Missing                     |
| HYD-PARTIAL-01 | Hydration                | P0       | ❌ Missing                     |
| HYD-PARTIAL-02 | Hydration                | P0       | ❌ Missing                     |
| HYD-PARTIAL-03 | Hydration                | P1       | ❌ Missing                     |
| HYD-PARTIAL-04 | Hydration                | P0       | ❌ Missing                     |
| HYD-PARTIAL-05 | Hydration                | P0       | ❌ Missing                     |
| STOR-01        | Storage                  | P1       | ❌ Missing                     |
| STOR-02        | Storage                  | P1       | ❌ Missing                     |
| STOR-03        | Storage                  | P1       | ❌ Missing                     |
| STOR-04        | Storage                  | P1       | ❌ Missing                     |
| ERR-20         | Partial Success          | P1       | ⚠️ Partial                     |
| PRG-01         | Progress Reporting       | P1       | ✅ Covered                     |
| EDGE-01        | Edge Cases               | P2       | ❌ Missing                     |
| EDGE-12        | Edge Cases               | P1       | ❌ Missing                     |

---

### 8.2 Full Test Specifications

Each test case follows this structure for test generation:

```typescript
interface TestCase {
  id: string;
  description: string;
  given: {
    localState: 'empty' | 'has_sessions' | SessionResource[];
    apiResponses: MockApiResponse[];
    options?: SyncOptions;
  };
  when: 'sync() is called';
  then: {
    stats?: Partial<SyncStats>;
    calls?: { method: string; times: number }[];
    throws?: { error: ErrorClass; message?: string };
  };
}
```

---

#### 8.2.1 Rate Limiting Expected Behavior Tests

##### RL-EXP-01: Unlimited retries on 429

```typescript
{
  id: 'RL-EXP-01',
  description: '429 handling with eventual success after many retries',
  given: {
    localState: 'empty',
    apiResponses: [
      { status: 429, count: 10 }, // Fail 10 times
      { status: 200, body: { sessions: [mockSession] } }
    ]
  },
  when: 'sync() is called',
  then: {
    stats: { sessionsIngested: 1 },
    throws: null // Must NOT throw
  }
}
```

##### RL-EXP-02: Backoff caps at maximum

```typescript
{
  id: 'RL-EXP-02',
  description: 'Backoff delay caps at MAX_BACKOFF_MS',
  given: {
    localState: 'empty',
    apiResponses: [
      { status: 429, count: 20 } // Many failures to trigger max backoff
    ]
  },
  when: 'calculateBackoff() is called for attempt 10',
  then: {
    backoffMs: 60000 // MAX_BACKOFF
  }
}
```

##### RL-EXP-05: Retry-After header respected

```typescript
{
  id: 'RL-EXP-05',
  description: 'Retry-After header overrides calculated backoff',
  given: {
    apiResponse: {
      status: 429,
      headers: { 'Retry-After': '120' } // 120 seconds
    }
  },
  when: 'Retry delay is calculated',
  then: {
    delayMs: 120000
  }
}
```

---

#### 8.2.2 Edge Case Tests

##### EDGE-01: Empty API response

```typescript
{
  id: 'EDGE-01',
  description: 'API returns zero sessions',
  given: {
    localState: 'empty',
    apiResponses: [{ status: 200, body: { sessions: [] } }]
  },
  when: 'sync() is called',
  then: {
    stats: { sessionsIngested: 0, activitiesIngested: 0, isComplete: true }
  }
}
```

##### EDGE-12: Exact high-water mark match

```typescript
{
  id: 'EDGE-12',
  description: 'Session createTime equals high-water mark exactly',
  given: {
    localState: [{ id: '1', createTime: '2023-01-02T00:00:00Z' }],
    apiResponses: [{
      status: 200,
      body: { sessions: [
        { id: '1', createTime: '2023-01-02T00:00:00Z' } // Same
      ]}
    }]
  },
  when: 'sync({ incremental: true })',
  then: {
    stats: { sessionsIngested: 0 } // Should stop, not re-ingest
  }
}
```

---

#### 8.2.3 Partial Success Tests

##### ERR-20: Continue after single hydration failure

```typescript
{
  id: 'ERR-20',
  description: 'Partial hydration success before failure',
  given: {
    localState: 'empty',
    sessions: ['session-1', 'session-2', 'session-3'],
    hydrationBehavior: {
      'session-1': { activities: 3 },
      'session-2': { activities: 2 },
      'session-3': { throws: 'NetworkError' }
    },
    options: { depth: 'activities', concurrency: 1 }
  },
  when: 'sync() is called',
  then: {
    throws: { error: 'JulesNetworkError' },
    sideEffects: {
      'session-1 activities persisted': true,
      'session-2 activities persisted': true
    }
  }
}
```

##### ERR-22: Continue on error option (PROPOSED)

```typescript
{
  id: 'ERR-22',
  description: 'continueOnError skips failed sessions',
  given: {
    sessions: ['session-1', 'session-2', 'session-3'],
    hydrationBehavior: {
      'session-2': { throws: 'NetworkError' }
    },
    options: { depth: 'activities', continueOnError: true }
  },
  when: 'sync() is called',
  then: {
    stats: { sessionsIngested: 3, activitiesIngested: 5 }, // s1 + s3
    throws: null,
    warnings: ['Failed to hydrate session-2: NetworkError']
  }
}
```

---

## Appendix A: Mock Helpers

```typescript
// Mock session factory
const createMockSession = (
  id: string,
  createTime: string,
): SessionResource => ({
  id,
  name: `sessions/${id}`,
  createTime,
  updateTime: createTime,
  state: 'completed',
  prompt: 'test',
  title: 'test',
  url: 'http://test.com',
  outputs: [],
  sourceContext: { source: 'github/owner/repo' },
});

// Mock API response factory
const create429Response = (retryAfter?: number): Response => {
  const headers = new Headers();
  if (retryAfter) headers.set('Retry-After', String(retryAfter));
  return new Response('Rate Limited', { status: 429, headers });
};

// Mock storage factory
const createMockStorage = () => ({
  scanIndex: vi.fn(),
  upsert: vi.fn(),
  get: vi.fn(),
});
```

---

## Appendix B: Configuration Constants

```typescript
// Rate limiting constants (CURRENT)
const CURRENT_MAX_RETRIES = 3;
const CURRENT_INITIAL_BACKOFF_MS = 1000;

// Rate limiting constants (PROPOSED)
const PROPOSED_MAX_RETRIES = Infinity;
const PROPOSED_INITIAL_BACKOFF_MS = 1000;
const PROPOSED_MAX_BACKOFF_MS = 60000;
const PROPOSED_BACKOFF_MULTIPLIER = 2;
const PROPOSED_BACKOFF_JITTER = 0.1; // ±10% randomization

// Sync defaults
const DEFAULT_LIMIT = 100;
const DEFAULT_DEPTH = 'metadata';
const DEFAULT_INCREMENTAL = true;
const DEFAULT_CONCURRENCY = 3;
```

---

## Appendix C: File References

| File                                | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `src/client.ts`                     | `sync()` implementation                        |
| `src/api.ts`                        | 429 retry logic                                |
| `src/errors.ts`                     | `JulesRateLimitError`                          |
| `src/types.ts`                      | `SyncOptions`, `SyncStats`                     |
| `src/activities/client.ts`          | `DefaultActivityClient` - hydration logic      |
| `src/storage/types.ts`              | `ActivityStorage`, `SessionStorage` interfaces |
| `tests/sync/reconciliation.test.ts` | Core sync tests                                |
| `tests/api-retry.test.ts`           | 429 retry tests                                |

---

## 9. Production Requirements

> [!IMPORTANT]
> This section documents **critical gaps** that must be addressed for `jules.sync()` to be a production-grade data download system with reliable incremental processing.

### 9.1 Cancellation & Abort Support

| ID            | Requirement                                     | Status             | Priority |
| ------------- | ----------------------------------------------- | ------------------ | -------- |
| PROD-ABORT-01 | Support `AbortSignal` for graceful cancellation | ❌ NOT Implemented | P0       |
| PROD-ABORT-02 | Clean up partial state when aborted             | ❌ NOT Implemented | P0       |
| PROD-ABORT-03 | Return partial stats on cancellation            | ❌ NOT Implemented | P1       |
| PROD-ABORT-04 | Cancel in-flight HTTP requests on abort         | ❌ NOT Implemented | P1       |

#### Proposed API

```typescript
interface SyncOptions {
  // ... existing options ...

  /**
   * AbortSignal to cancel the sync operation.
   * When aborted, sync will stop processing and return partial results.
   */
  signal?: AbortSignal;
}

// Usage
const controller = new AbortController();
const promise = jules.sync({ signal: controller.signal });

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30_000);
```

#### Test Case: PROD-ABORT-01

```
GIVEN: sync() is running with 100 sessions to process
AND: AbortSignal is triggered after 10 sessions
WHEN: Signal aborts
THEN: sync() stops processing
THEN: Returns stats with sessionsIngested === 10
THEN: No error is thrown (graceful cancellation)
```

---

### 9.2 Timeout Handling

| ID              | Requirement                                                | Status             | Priority |
| --------------- | ---------------------------------------------------------- | ------------------ | -------- |
| PROD-TIMEOUT-01 | Overall sync timeout option                                | ❌ NOT Implemented | P1       |
| PROD-TIMEOUT-02 | Per-session hydration timeout                              | ❌ NOT Implemented | P1       |
| PROD-TIMEOUT-03 | Per-request timeout (exists but not configurable per-sync) | ⚠️ Partial         | P2       |

#### Proposed API

```typescript
interface SyncOptions {
  /**
   * Maximum time in ms for entire sync operation.
   * @default undefined (no limit)
   */
  timeoutMs?: number;

  /**
   * Maximum time in ms for hydrating a single session.
   * Sessions that exceed this are skipped with a warning.
   * @default undefined (no limit)
   */
  sessionTimeoutMs?: number;
}
```

#### Test Case: PROD-TIMEOUT-01

```
GIVEN: sync() is configured with timeoutMs: 5000
AND: Hydration takes 10 seconds per session
WHEN: Timeout is reached
THEN: sync() stops and returns partial results
THEN: stats.isComplete === false
```

---

### 9.3 Checkpointing & Resume

| ID           | Requirement                               | Status             | Priority |
| ------------ | ----------------------------------------- | ------------------ | -------- |
| PROD-CKPT-01 | Persist sync progress to disk             | ❌ NOT Implemented | P0       |
| PROD-CKPT-02 | Resume from last checkpoint on restart    | ❌ NOT Implemented | P0       |
| PROD-CKPT-03 | Checkpoint after each session completes   | ❌ NOT Implemented | P1       |
| PROD-CKPT-04 | Atomically update checkpoint (crash-safe) | ❌ NOT Implemented | P1       |

#### Proposed Design

```typescript
// .jules/cache/sync_checkpoint.json
interface SyncCheckpoint {
  syncId: string; // Unique ID for this sync run
  startedAt: number; // Epoch timestamp
  lastProcessedSessionId?: string; // Resume point
  lastProcessedSessionCreateTime?: string;
  options: SyncOptions; // Original options
  sessionsProcessed: number;
  activitiesIngested: number;
}

interface SyncOptions {
  /**
   * Enable checkpointing for crash recovery.
   * @default false
   */
  checkpoint?: boolean;

  /**
   * Resume from a previous checkpoint if one exists.
   * @default true (when checkpoint: true)
   */
  resumeFromCheckpoint?: boolean;
}
```

#### Test Case: PROD-CKPT-02

```
GIVEN: Previous sync crashed at session 50 of 100
AND: Checkpoint file exists with lastProcessedSessionId
WHEN: sync({ checkpoint: true }) is called
THEN: Sync resumes from session 51
THEN: Sessions 1-50 are NOT re-fetched
```

---

### 9.4 Data Validation & Integrity

| ID          | Requirement                          | Status             | Priority |
| ----------- | ------------------------------------ | ------------------ | -------- |
| PROD-VAL-01 | Validate session response schema     | ❌ NOT Implemented | P1       |
| PROD-VAL-02 | Validate activity response schema    | ❌ NOT Implemented | P1       |
| PROD-VAL-03 | Detect and handle corrupt local data | ❌ NOT Implemented | P0       |
| PROD-VAL-04 | Skip malformed records with warning  | ❌ NOT Implemented | P1       |

#### Test Case: PROD-VAL-03

```
GIVEN: Local cache contains corrupt JSON in session file
WHEN: sync({ incremental: true }) scans local cache
THEN: Corrupt record is skipped with warning
THEN: Session is re-fetched from network
THEN: sync() does not crash
```

---

### 9.5 Memory Management

| ID          | Requirement                                           | Status             | Priority |
| ----------- | ----------------------------------------------------- | ------------------ | -------- |
| PROD-MEM-01 | Stream processing (don't hold all sessions in memory) | ⚠️ Partial         | P1       |
| PROD-MEM-02 | Limit candidate buffer size                           | ⚠️ Partial         | P1       |
| PROD-MEM-03 | Flush activities to disk incrementally                | ✅ Implemented     | -        |
| PROD-MEM-04 | Option to limit memory usage                          | ❌ NOT Implemented | P2       |

#### Current Issue

```typescript
// In sync() - candidates array grows unbounded
const candidates: SessionResource[] = [];
for await (const session of cursor) {
  candidates.push(session); // <-- Memory grows with limit
}
```

**Concern**: If `limit: 10000`, all 10,000 sessions are held in memory before hydration begins.

#### Proposed Fix

Stream processing with bounded buffer:

```typescript
// Process sessions as they arrive, don't buffer all
for await (const session of cursor) {
  await this.storage.upsert(session);
  sessionsIngested++;

  if (depth === 'activities') {
    // Hydrate immediately with semaphore for concurrency
    await semaphore.acquire();
    hydrateSession(session).finally(() => semaphore.release());
  }
}
```

---

### 9.6 Filtering & Selective Sync

| ID             | Requirement                         | Status             | Priority |
| -------------- | ----------------------------------- | ------------------ | -------- |
| PROD-FILTER-01 | Filter sessions by state            | ❌ NOT Implemented | P1       |
| PROD-FILTER-02 | Filter sessions by source/repo      | ❌ NOT Implemented | P1       |
| PROD-FILTER-03 | Filter sessions by date range       | ❌ NOT Implemented | P2       |
| PROD-FILTER-04 | Filter sessions by custom predicate | ❌ NOT Implemented | P2       |

#### Proposed API

```typescript
interface SyncOptions {
  /**
   * Only sync sessions matching these filters.
   */
  filter?: {
    state?: SessionState | SessionState[];
    source?: string; // "sources/github/owner/repo"
    createdAfter?: Date;
    createdBefore?: Date;
    predicate?: (session: SessionResource) => boolean;
  };
}
```

#### Test Case: PROD-FILTER-01

```
GIVEN: API returns sessions with states [completed, failed, inProgress]
WHEN: sync({ filter: { state: 'completed' } })
THEN: Only 'completed' sessions are ingested
```

---

### 9.7 Idempotency & Deduplication

| ID           | Requirement                                     | Status             | Priority |
| ------------ | ----------------------------------------------- | ------------------ | -------- |
| PROD-IDEM-01 | Multiple concurrent sync() calls should be safe | ❌ NOT Implemented | P0       |
| PROD-IDEM-02 | Use locking to prevent parallel syncs           | ❌ NOT Implemented | P0       |
| PROD-IDEM-03 | Activity deduplication by ID                    | ✅ Implemented     | -        |
| PROD-IDEM-04 | Session upsert (not insert)                     | ✅ Implemented     | -        |

#### Proposed Design

```typescript
// Acquire lock before sync
const lockFile = '.jules/cache/sync.lock';

async function sync(options: SyncOptions): Promise<SyncStats> {
  const lock = await acquireLock(lockFile, { timeout: 5000 });
  if (!lock) {
    throw new SyncInProgressError('Another sync is already running');
  }

  try {
    return await doSync(options);
  } finally {
    await lock.release();
  }
}
```

#### Test Case: PROD-IDEM-01

```
GIVEN: sync() is already running
WHEN: Second sync() is called concurrently
THEN: Second call waits for lock OR throws SyncInProgressError
THEN: No data corruption occurs
```

---

### 9.8 Metrics & Observability

| ID              | Requirement                        | Status             | Priority |
| --------------- | ---------------------------------- | ------------------ | -------- |
| PROD-METRICS-01 | Track sync duration breakdown      | ❌ NOT Implemented | P2       |
| PROD-METRICS-02 | Track network requests count       | ❌ NOT Implemented | P2       |
| PROD-METRICS-03 | Track retry counts                 | ❌ NOT Implemented | P2       |
| PROD-METRICS-04 | Track bytes transferred            | ❌ NOT Implemented | P3       |
| PROD-METRICS-05 | Emit structured logs for debugging | ❌ NOT Implemented | P2       |

#### Proposed Enhanced Stats

```typescript
interface SyncStats {
  sessionsIngested: number;
  activitiesIngested: number;
  isComplete: boolean;
  durationMs: number;

  // Enhanced metrics
  metrics?: {
    listDurationMs: number;
    hydrationDurationMs: number;
    networkRequestsTotal: number;
    networkRequestsRetried: number;
    rateLimitDelayMs: number; // Total time spent waiting on 429
    bytesDownloaded: number;
    sessionsSkipped: number; // Already synced
    sessionsFailed: number; // Errors during hydration
  };
}
```

---

### 9.9 Storage Corruption Recovery

| ID              | Requirement                                 | Status             | Priority |
| --------------- | ------------------------------------------- | ------------------ | -------- |
| PROD-CORRUPT-01 | Detect corrupt session index                | ❌ NOT Implemented | P1       |
| PROD-CORRUPT-02 | Rebuild index from individual session files | ❌ NOT Implemented | P1       |
| PROD-CORRUPT-03 | Detect corrupt activity cache               | ❌ NOT Implemented | P1       |
| PROD-CORRUPT-04 | Auto-heal by re-fetching corrupt sessions   | ❌ NOT Implemented | P2       |

#### Proposed API

```typescript
// Separate repair utility
await jules.storage.repair({
  rebuildIndex: true,
  validateIntegrity: true,
  autoHeal: true, // Re-fetch corrupt data from network
});
```

---

### 9.10 Implementation Priority Matrix

| Priority | Features                                                        | Impact                         |
| -------- | --------------------------------------------------------------- | ------------------------------ |
| **P0**   | Cancellation, Checkpointing, Idempotency, Corrupt Data Handling | Data integrity, crash recovery |
| **P1**   | Timeouts, Data Validation, Memory Management, Filtering         | Reliability, performance       |
| **P2**   | Metrics, Enhanced Stats, Storage Repair                         | Observability, debugging       |
| **P3**   | Bytes tracking, Custom predicates                               | Nice-to-have                   |

---

### 9.11 Test Cases: Production Requirements

#### PROD-ABORT-01: Graceful cancellation

```typescript
{
  id: 'PROD-ABORT-01',
  description: 'Cancel sync gracefully via AbortSignal',
  given: {
    sessions: Array(100).fill(mockSession),
    options: { signal: controller.signal }
  },
  when: 'controller.abort() called after 10 sessions',
  then: {
    stats: { sessionsIngested: 10, isComplete: false },
    throws: null
  }
}
```

#### PROD-CKPT-02: Resume from checkpoint

```typescript
{
  id: 'PROD-CKPT-02',
  description: 'Resume sync from crash checkpoint',
  given: {
    checkpoint: { lastProcessedSessionId: 'session-50', sessionsProcessed: 50 },
    sessions: Array(100).fill(mockSession)
  },
  when: 'sync({ checkpoint: true })',
  then: {
    stats: { sessionsIngested: 50 }, // Only remaining 50
    startedFromSession: 'session-51'
  }
}
```

#### PROD-VAL-03: Handle corrupt local data

```typescript
{
  id: 'PROD-VAL-03',
  description: 'Skip corrupt local cache gracefully',
  given: {
    localCache: [
      { id: '1', valid: true },
      { id: '2', corrupt: true },  // JSON parse error
      { id: '3', valid: true },
    ]
  },
  when: 'sync({ incremental: true })',
  then: {
    warnings: ['Corrupt cache for session 2, re-fetching'],
    stats: { sessionsIngested: 3 } // All sessions successfully synced
  }
}
```

#### PROD-IDEM-01: Concurrent sync safety

```typescript
{
  id: 'PROD-IDEM-01',
  description: 'Prevent concurrent sync operations',
  given: {
    syncInProgress: true
  },
  when: 'Second sync() called',
  then: {
    throws: { error: 'SyncInProgressError' }
    // OR waits for lock (configurable)
  }
}
```

---

## Appendix D: API Dependencies

For some production features, the Jules API may need to provide additional endpoints:

| Feature               | Required API Support                                      |
| --------------------- | --------------------------------------------------------- |
| Activity count check  | `GET /sessions/{id}/activities?count_only=true` or header |
| Latest activity ID    | `GET /sessions/{id}/activities?page_size=1&order=desc`    |
| Session filtering     | `GET /sessions?filter.state=completed` (may exist)        |
| Efficient incremental | `GET /sessions/{id}/activities?after_id={id}`             |

---

## Appendix E: Breaking Changes Policy

> [!NOTE]
> This library is **experimental**. Breaking changes are acceptable to implement production-grade features. No backwards compatibility guarantees are provided.
