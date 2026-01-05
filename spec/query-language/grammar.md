# Jules Query Language (JQL) Specification

## 1. Overview

JQL is a declarative query language for querying sessions and activities
from the Jules local cache. It supports SQL-like projection, filtering,
and traversal of nested document structures.

## 2. Query Structure

```
{
  from: Domain,
  select?: SelectExpression[],
  where?: WhereClause,
  order?: 'asc' | 'desc',
  limit?: number,
  startAfter?: string
}
```

## 3. Domains

```
Domain := 'sessions' | 'activities'
```

Each domain has a root document type:

- `sessions` → SessionResource
- `activities` → Activity (discriminated union)

## 4. Select Expressions

### 4.1 Grammar

```
SelectExpression :=
  | FieldPath           -- Include field
  | '*'                 -- Include all root fields
  | '-' FieldPath       -- Exclude field

FieldPath :=
  | Identifier                      -- Root field
  | FieldPath '.' Identifier        -- Nested field
  | FieldPath '[]'                  -- Array marker (optional, implicit)
  | FieldPath '[].' Identifier      -- Field within array elements
```

### 4.2 Semantics

- Empty select or omitted: Returns default projection (domain-specific)
- `["*"]`: Returns all fields at all depths
- Inclusion is additive: `["id", "type"]` returns only those fields
- Exclusion takes precedence: `["*", "-artifacts.data"]` returns all except data
- Array traversal is implicit: `artifacts.type` ≡ `artifacts[].type`

### 4.3 Default Projections

```
sessions.default  := [id, state, title, createTime]
activities.default := [id, type, createTime, originator, artifactCount, summary]
```

Note: `artifactCount` and `summary` are computed fields (see §6).

### 4.4 Examples

```javascript
// Minimal
{
  select: ['id'];
}

// Nested paths
{
  select: ['id', 'plan.steps.title', 'plan.steps.index'];
}

// Wildcard with exclusions
{
  select: [
    '*',
    '-artifacts.data',
    '-artifacts.changeSet.gitPatch.unidiffPatch',
  ];
}

// Array element fields
{
  select: ['artifacts.type', 'artifacts.command', 'artifacts.exitCode'];
}
```

## 5. Where Clause

### 5.1 Grammar

```
WhereClause := { [FieldPath]: FilterValue }

FilterValue :=
  | Literal                         -- Equality shorthand
  | { eq: Literal }                 -- Equality
  | { neq: Literal }                -- Inequality
  | { gt: Literal }                 -- Greater than
  | { lt: Literal }                 -- Less than
  | { gte: Literal }                -- Greater than or equal
  | { lte: Literal }                -- Less than or equal
  | { in: Literal[] }               -- Set membership
  | { contains: string }            -- Substring match (case-insensitive)
  | { exists: boolean }             -- Field existence

Literal := string | number | boolean | null
```

### 5.2 Path Semantics in Where

When a path traverses an array, the filter uses **existential quantification**:
the document matches if ANY array element satisfies the condition.

```javascript
// Matches activities where at least one artifact is bashOutput
{ where: { "artifacts.type": "bashOutput" } }

// Matches activities where at least one artifact has exitCode ≠ 0
{ where: { "artifacts.exitCode": { neq: 0 } } }
```

### 5.3 Combining Conditions

Multiple conditions are ANDed:

```javascript
{
  where: {
    sessionId: "123",
    type: "progressUpdated",
    "artifacts.type": "bashOutput"
  }
}
// Matches: sessionId=123 AND type=progressUpdated AND ∃artifact(type=bashOutput)
```

### 5.4 Domain-Specific Fields

**Sessions:**

- `id`, `state`, `title`, `createTime`, `updateTime`, `prompt`
- `sourceContext.source`, `sourceContext.githubRepoContext.startingBranch`
- `outputs.type`, `outputs.pullRequest.url`

**Activities:**

- `id`, `type`, `createTime`, `originator`, `sessionId`
- `message` (agentMessaged, userMessaged)
- `plan.id`, `plan.steps.title` (planGenerated)
- `title`, `description` (progressUpdated)
- `reason` (sessionFailed)
- `artifacts.*` (all types)

## 6. Computed Fields

Computed fields are derived at query time, not stored.

| Field           | Domain     | Type   | Description                            |
| --------------- | ---------- | ------ | -------------------------------------- |
| `artifactCount` | activities | number | Length of artifacts array              |
| `summary`       | activities | string | Human-readable summary (type-specific) |
| `durationMs`    | sessions   | number | updateTime - createTime in ms          |

Computed fields can be selected but not filtered.

## 7. Ordering & Pagination

### 7.1 Order

```
order := 'asc' | 'desc'  -- Default: 'desc'
```

Primary sort: `createTime`
Secondary sort (tiebreaker): `id`

### 7.2 Cursor Pagination

```
startAfter := ActivityId | SessionId  -- Exclusive cursor
```

Cursor resolves to `(createTime, id)` tuple for stable pagination.

### 7.3 Limit

```
limit := PositiveInteger  -- Default: 100, Max: 1000
```

## 8. Result Shape

### 8.1 Projection Determines Shape

The result shape mirrors the select paths:

```javascript
// Query
{ select: ["id", "artifacts.type", "artifacts.command"] }

// Result (single activity)
{
  id: "abc123",
  artifacts: [
    { type: "bashOutput", command: "npm test" },
    { type: "bashOutput", command: "npm build" }
  ]
}
```

### 8.2 Missing Fields

- If a path doesn't exist on a document, it's omitted (not null)
- Type-conditional fields only appear on matching types:
  - `message` only on agentMessaged/userMessaged
  - `plan` only on planGenerated

## 9. Error Handling

| Error             | Condition                                    |
| ----------------- | -------------------------------------------- |
| `InvalidDomain`   | from ∉ {sessions, activities}                |
| `InvalidPath`     | Path doesn't exist in schema                 |
| `InvalidOperator` | Filter operator not supported for field type |
| `InvalidCursor`   | startAfter ID not found                      |
