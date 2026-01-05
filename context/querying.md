# Query Language Specification & Implementation Plan

## Part 1: Query Language Specification

### 1.1 `spec/query-language/grammar.md`

```markdown
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
| FieldPath -- Include field
| '\*' -- Include all root fields
| '-' FieldPath -- Exclude field

FieldPath :=
| Identifier -- Root field
| FieldPath '.' Identifier -- Nested field
| FieldPath '[]' -- Array marker (optional, implicit)
| FieldPath '[].' Identifier -- Field within array elements

```

### 4.2 Semantics

- Empty select or omitted: Returns default projection (domain-specific)
- `["*"]`: Returns all fields at all depths
- Inclusion is additive: `["id", "type"]` returns only those fields
- Exclusion takes precedence: `["*", "-artifacts.data"]` returns all except data
- Array traversal is implicit: `artifacts.type` ≡ `artifacts[].type`

### 4.3 Default Projections

```

sessions.default := [id, state, title, createTime]
activities.default := [id, type, createTime, originator, artifactCount, summary]

````

Note: `artifactCount` and `summary` are computed fields (see §6).

### 4.4 Examples

```javascript
// Minimal
{ select: ["id"] }

// Nested paths
{ select: ["id", "plan.steps.title", "plan.steps.index"] }

// Wildcard with exclusions
{ select: ["*", "-artifacts.data", "-artifacts.changeSet.gitPatch.unidiffPatch"] }

// Array element fields
{ select: ["artifacts.type", "artifacts.command", "artifacts.exitCode"] }
````

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

````

---

### 1.2 `spec/query-language/cases.yaml`

```yaml
# Query Language Test Cases
version: "1.0"

cases:
  # ============================================
  # SELECT - Basic Projection
  # ============================================

  - id: SEL-01
    description: Empty select returns domain default projection
    category: select_basic
    priority: P0
    given:
      query:
        from: activities
        where: { id: "act-1" }
        # select omitted
      data:
        - id: "act-1"
          type: "progressUpdated"
          createTime: "2024-01-01T00:00:00Z"
          originator: "agent"
          title: "Working..."
          description: "Doing stuff"
          artifacts: [{ type: "bashOutput", command: "ls", stdout: "file.txt", exitCode: 0 }]
    then:
      returns:
        - id: "act-1"
          type: "progressUpdated"
          createTime: "2024-01-01T00:00:00Z"
          originator: "agent"
          artifactCount: 1
          summary: "Working...: Doing stuff"

  - id: SEL-02
    description: Explicit select returns only specified fields
    category: select_basic
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "type"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "agentMessaged"
          createTime: "2024-01-01T00:00:00Z"
          message: "Hello world"
          artifacts: []
    then:
      returns:
        - id: "act-1"
          type: "agentMessaged"
          # No other fields

  - id: SEL-03
    description: Wildcard select returns all fields
    category: select_basic
    priority: P0
    given:
      query:
        from: activities
        select: ["*"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "agentMessaged"
          createTime: "2024-01-01T00:00:00Z"
          originator: "agent"
          message: "Hello"
          artifacts: []
    then:
      returns:
        - id: "act-1"
          type: "agentMessaged"
          createTime: "2024-01-01T00:00:00Z"
          originator: "agent"
          message: "Hello"
          artifacts: []
          artifactCount: 0
          summary: "Hello"

  # ============================================
  # SELECT - Nested Path Projection
  # ============================================

  - id: SEL-10
    description: Dot notation selects nested object fields
    category: select_nested
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "plan.steps.title"]
        where: { type: "planGenerated" }
      data:
        - id: "act-1"
          type: "planGenerated"
          createTime: "2024-01-01T00:00:00Z"
          plan:
            id: "plan-1"
            steps:
              - { id: "s1", title: "Step 1", description: "Do X", index: 0 }
              - { id: "s2", title: "Step 2", description: "Do Y", index: 1 }
            createTime: "2024-01-01T00:00:00Z"
          artifacts: []
    then:
      returns:
        - id: "act-1"
          plan:
            steps:
              - { title: "Step 1" }
              - { title: "Step 2" }

  - id: SEL-11
    description: Multiple nested paths from same parent
    category: select_nested
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "plan.steps.title", "plan.steps.index"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "planGenerated"
          plan:
            id: "plan-1"
            steps:
              - { id: "s1", title: "First", description: "...", index: 0 }
    then:
      returns:
        - id: "act-1"
          plan:
            steps:
              - { title: "First", index: 0 }

  - id: SEL-12
    description: Array element projection on artifacts
    category: select_nested
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "artifacts.type", "artifacts.command"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "progressUpdated"
          artifacts:
            - { type: "bashOutput", command: "npm test", stdout: "PASS", stderr: "", exitCode: 0 }
            - { type: "media", format: "image/png", data: "base64..." }
    then:
      returns:
        - id: "act-1"
          artifacts:
            - { type: "bashOutput", command: "npm test" }
            - { type: "media" }  # command doesn't exist, omitted

  - id: SEL-13
    description: Deep nested path through changeSet
    category: select_nested
    priority: P1
    given:
      query:
        from: activities
        select: ["id", "artifacts.changeSet.gitPatch.suggestedCommitMessage"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "progressUpdated"
          artifacts:
            - type: "changeSet"
              changeSet:
                source: "sources/github/foo/bar"
                gitPatch:
                  unidiffPatch: "diff --git..."
                  baseCommitId: "abc123"
                  suggestedCommitMessage: "Fix bug"
    then:
      returns:
        - id: "act-1"
          artifacts:
            - changeSet:
                gitPatch:
                  suggestedCommitMessage: "Fix bug"

  # ============================================
  # SELECT - Exclusion
  # ============================================

  - id: SEL-20
    description: Exclusion with dash prefix
    category: select_exclusion
    priority: P0
    given:
      query:
        from: activities
        select: ["*", "-artifacts.data"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "progressUpdated"
          createTime: "2024-01-01T00:00:00Z"
          artifacts:
            - { type: "media", format: "image/png", data: "base64encodeddata" }
    then:
      returns:
        - id: "act-1"
          type: "progressUpdated"
          createTime: "2024-01-01T00:00:00Z"
          artifacts:
            - { type: "media", format: "image/png" }
          # data field excluded

  - id: SEL-21
    description: Multiple exclusions
    category: select_exclusion
    priority: P0
    given:
      query:
        from: activities
        select: ["*", "-artifacts.data", "-artifacts.changeSet.gitPatch.unidiffPatch"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "progressUpdated"
          artifacts:
            - type: "changeSet"
              changeSet:
                source: "src"
                gitPatch:
                  unidiffPatch: "very long diff..."
                  baseCommitId: "abc"
                  suggestedCommitMessage: "Fix"
    then:
      returns:
        - id: "act-1"
          type: "progressUpdated"
          artifacts:
            - type: "changeSet"
              changeSet:
                source: "src"
                gitPatch:
                  baseCommitId: "abc"
                  suggestedCommitMessage: "Fix"
                  # unidiffPatch excluded

  - id: SEL-22
    description: Exclusion takes precedence over inclusion
    category: select_exclusion
    priority: P0
    given:
      query:
        from: activities
        select: ["artifacts", "-artifacts.data"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          artifacts:
            - { type: "media", format: "image/png", data: "base64..." }
    then:
      returns:
        - id: "act-1"
          artifacts:
            - { type: "media", format: "image/png" }

  # ============================================
  # WHERE - Nested Path Filtering
  # ============================================

  - id: WHERE-10
    description: Filter on nested artifact type
    category: where_nested
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "artifacts.command", "artifacts.exitCode"]
        where:
          "artifacts.type": "bashOutput"
      data:
        - id: "act-1"
          artifacts:
            - { type: "bashOutput", command: "npm test", exitCode: 0 }
        - id: "act-2"
          artifacts:
            - { type: "media", format: "image/png", data: "..." }
        - id: "act-3"
          artifacts:
            - { type: "bashOutput", command: "npm build", exitCode: 1 }
            - { type: "media", format: "image/png", data: "..." }
    then:
      returns:
        - id: "act-1"
          artifacts:
            - { command: "npm test", exitCode: 0 }
        - id: "act-3"
          artifacts:
            - { command: "npm build", exitCode: 1 }
            - {}  # media artifact (no command/exitCode)

  - id: WHERE-11
    description: Filter with neq operator on nested field
    category: where_nested
    priority: P0
    given:
      query:
        from: activities
        where:
          "artifacts.exitCode": { neq: 0 }
        select: ["id", "artifacts.command", "artifacts.exitCode"]
      data:
        - id: "act-1"
          artifacts:
            - { type: "bashOutput", command: "npm test", exitCode: 0 }
        - id: "act-2"
          artifacts:
            - { type: "bashOutput", command: "npm build", exitCode: 1 }
    then:
      returns:
        - id: "act-2"
          artifacts:
            - { command: "npm build", exitCode: 1 }

  - id: WHERE-12
    description: Existential semantics - matches if ANY artifact matches
    category: where_nested
    priority: P0
    given:
      query:
        from: activities
        where:
          "artifacts.type": "changeSet"
        select: ["id"]
      data:
        - id: "act-1"
          artifacts:
            - { type: "bashOutput", command: "ls", exitCode: 0 }
            - { type: "changeSet", changeSet: { source: "src" } }
        - id: "act-2"
          artifacts:
            - { type: "bashOutput", command: "pwd", exitCode: 0 }
    then:
      returns:
        - id: "act-1"  # Has at least one changeSet

  - id: WHERE-13
    description: Combined top-level and nested filters
    category: where_nested
    priority: P0
    given:
      query:
        from: activities
        where:
          sessionId: "sess-1"
          type: "progressUpdated"
          "artifacts.exitCode": { neq: 0 }
        select: ["id", "artifacts.command", "artifacts.stderr"]
      data:
        - id: "act-1"
          sessionId: "sess-1"
          type: "progressUpdated"
          artifacts:
            - { type: "bashOutput", command: "npm test", stderr: "Error!", exitCode: 1 }
        - id: "act-2"
          sessionId: "sess-1"
          type: "progressUpdated"
          artifacts:
            - { type: "bashOutput", command: "npm build", stderr: "", exitCode: 0 }
        - id: "act-3"
          sessionId: "sess-2"
          type: "progressUpdated"
          artifacts:
            - { type: "bashOutput", command: "fail", stderr: "Oops", exitCode: 1 }
    then:
      returns:
        - id: "act-1"
          artifacts:
            - { command: "npm test", stderr: "Error!" }

  - id: WHERE-14
    description: Filter with exists operator
    category: where_nested
    priority: P1
    given:
      query:
        from: activities
        where:
          "artifacts.changeSet": { exists: true }
        select: ["id"]
      data:
        - id: "act-1"
          artifacts:
            - { type: "changeSet", changeSet: { source: "src" } }
        - id: "act-2"
          artifacts:
            - { type: "bashOutput", command: "ls", exitCode: 0 }
    then:
      returns:
        - id: "act-1"

  # ============================================
  # SELECT - Computed Fields
  # ============================================

  - id: COMP-01
    description: artifactCount computed field
    category: computed
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "artifactCount"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          artifacts:
            - { type: "bashOutput", command: "a", exitCode: 0 }
            - { type: "bashOutput", command: "b", exitCode: 0 }
            - { type: "media", format: "image/png", data: "..." }
    then:
      returns:
        - id: "act-1"
          artifactCount: 3

  - id: COMP-02
    description: summary computed field for progressUpdated
    category: computed
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "summary"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "progressUpdated"
          title: "Building"
          description: "Running npm build"
    then:
      returns:
        - id: "act-1"
          summary: "Building: Running npm build"

  - id: COMP-03
    description: summary computed field for planGenerated
    category: computed
    priority: P0
    given:
      query:
        from: activities
        select: ["id", "summary"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "planGenerated"
          plan:
            steps:
              - { id: "s1", title: "A", index: 0 }
              - { id: "s2", title: "B", index: 1 }
              - { id: "s3", title: "C", index: 2 }
    then:
      returns:
        - id: "act-1"
          summary: "Plan generated with 3 steps"

  # ============================================
  # Edge Cases
  # ============================================

  - id: EDGE-01
    description: Path to non-existent field returns empty
    category: edge_cases
    priority: P1
    given:
      query:
        from: activities
        select: ["id", "nonexistent.field"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          type: "agentMessaged"
    then:
      returns:
        - id: "act-1"
          # nonexistent.field omitted, not null

  - id: EDGE-02
    description: Type-conditional field only on matching types
    category: edge_cases
    priority: P1
    given:
      query:
        from: activities
        select: ["id", "type", "message", "plan.steps.title"]
      data:
        - id: "act-1"
          type: "agentMessaged"
          message: "Hello"
        - id: "act-2"
          type: "planGenerated"
          plan: { steps: [{ title: "Do X" }] }
    then:
      returns:
        - id: "act-1"
          type: "agentMessaged"
          message: "Hello"
          # no plan field
        - id: "act-2"
          type: "planGenerated"
          plan: { steps: [{ title: "Do X" }] }
          # no message field

  - id: EDGE-03
    description: Empty artifacts array
    category: edge_cases
    priority: P1
    given:
      query:
        from: activities
        select: ["id", "artifacts.type"]
        where: { id: "act-1" }
      data:
        - id: "act-1"
          artifacts: []
    then:
      returns:
        - id: "act-1"
          artifacts: []
````

---

## Part 2: Implementation Plan

### Phase 1: Spec Files

1. Create `spec/query-language/grammar.md` - Full language specification
2. Create `spec/query-language/cases.yaml` - Test cases above

### Phase 2: Projection Engine

1. Create `src/query/projection.ts`:
   - `parseSelectExpression(expr: string)` → `{ path: string[], exclude: boolean }`
   - `projectDocument(doc: any, selects: SelectExpression[])` → projected doc
   - `getPath(obj: any, path: string[])` → value or undefined
   - `setPath(obj: any, path: string[], value: any)` → mutates obj

### Phase 3: Enhanced Where Clause

1. Update `src/query/select.ts`:
   - Parse dot-notation keys in where clause
   - Implement existential matching for array paths
   - Add `exists` operator

### Phase 4: Computed Fields

1. Update `src/mcp/lightweight.ts` or create `src/query/computed.ts`:
   - `computeArtifactCount(activity)`
   - `computeSummary(activity)` (already exists as toSummary)
   - Inject computed fields during projection

### Phase 5: Update Types

1. Update `src/types.ts`:
   - `select?: string[]` (now supports dot notation and `-` prefix)
   - Add `exists` to FilterOp
   - Update WhereClause to allow string keys (dot paths)

### Phase 6: Schema Introspection Tool

1. Create `src/mcp/schema.ts` - TypeScript definitions as strings
2. Add `jules_schema` MCP tool

### Phase 7: Tests

1. Create `tests/query-language/spec.test.ts` - Drive from cases.yaml

---

## Files Summary

| File                                | Action |
| ----------------------------------- | ------ |
| `spec/query-language/grammar.md`    | CREATE |
| `spec/query-language/cases.yaml`    | CREATE |
| `src/query/projection.ts`           | CREATE |
| `src/query/computed.ts`             | CREATE |
| `src/query/select.ts`               | MODIFY |
| `src/types.ts`                      | MODIFY |
| `src/mcp/schema.ts`                 | CREATE |
| `src/mcp/server/index.ts`           | MODIFY |
| `tests/query-language/spec.test.ts` | CREATE |
