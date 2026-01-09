import type { QueryHelpTopic } from './types.js';

/**
 * Get LLM-optimized query documentation.
 *
 * @param topic - Topic to get help for
 * @returns Help content as markdown string
 */
export function getQueryHelp(topic: QueryHelpTopic = 'examples'): string {
  switch (topic) {
    case 'where':
      return `## WHERE Clause

**Rules:**
1. Multiple conditions are ANDed together
2. Array paths use existential matching (ANY element matches)
3. Use dot notation for nested fields (e.g., "artifacts.type")
4. Cannot filter on computed fields (artifactCount, summary, durationMs)

**Examples:**
\`\`\`json
{ "from": "activities", "where": { "type": "agentMessaged" } }
{ "from": "activities", "where": { "artifacts.type": "bashOutput" } }
{ "from": "sessions", "where": { "state": { "in": ["running", "waiting"] } } }
\`\`\`

**Avoid:**
- Filtering on computed fields (use select instead)
- OR logic (not supported - use multiple queries)
- Deeply nested paths without checking schema`;

    case 'select':
      return `## SELECT Projection

**Rules:**
1. Omit select for default projection (recommended)
2. Use ["*"] to get all fields including computed
3. Prefix with "-" to exclude fields (e.g., ["-artifacts"])
4. Computed fields: artifactCount, summary, durationMs

**Examples:**
\`\`\`json
{ "from": "sessions" }
{ "from": "sessions", "select": ["id", "title", "state"] }
{ "from": "activities", "select": ["*", "-artifacts"] }
{ "from": "activities", "select": ["id", "type", "artifactCount"] }
\`\`\`

**Avoid:**
- Selecting non-existent fields (causes warnings)
- Over-fetching with ["*"] when only a few fields needed`;

    case 'operators':
      return `## Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| eq | Equals (default) | { "state": "completed" } or { "state": { "eq": "completed" } } |
| neq | Not equals | { "state": { "neq": "failed" } } |
| contains | Case-insensitive substring | { "title": { "contains": "auth" } } |
| gt, gte | Greater than (or equal) | { "createTime": { "gt": "2024-01-01" } } |
| lt, lte | Less than (or equal) | { "limit": { "lte": 100 } } |
| in | Value in array | { "type": { "in": ["agentMessaged", "userMessaged"] } } |
| exists | Field exists/is non-null | { "pr": { "exists": true } } |

**Type Requirements:**
- eq/neq/gt/lt/gte/lte: primitive (string, number, boolean, null)
- contains: string only
- in: array of values
- exists: boolean only`;

    case 'examples':
      return `## Common Query Patterns

**Find recent sessions:**
\`\`\`json
{ "from": "sessions", "limit": 10, "order": "desc" }
\`\`\`

**Find failed sessions:**
\`\`\`json
{ "from": "sessions", "where": { "state": "failed" } }
\`\`\`

**Find activities with bash output:**
\`\`\`json
{ "from": "activities", "where": { "artifacts.type": "bashOutput" } }
\`\`\`

**Search sessions by title:**
\`\`\`json
{ "from": "sessions", "where": { "search": "authentication" } }
\`\`\`

**Get session with activities:**
\`\`\`json
{
  "from": "sessions",
  "where": { "id": "12345" },
  "include": { "activities": { "limit": 20 } }
}
\`\`\`

**Paginate with cursor:**
\`\`\`json
{ "from": "activities", "limit": 10, "startAfter": "last-id-here" }
\`\`\``;

    case 'errors':
      return `## Common Mistakes

**1. Invalid domain**
\`\`\`json
// Wrong
{ "from": "session" }
// Correct
{ "from": "sessions" }
\`\`\`

**2. Filtering on computed fields**
\`\`\`json
// Wrong - artifactCount is computed
{ "from": "activities", "where": { "artifactCount": { "gt": 0 } } }
// Correct - use select instead
{ "from": "activities", "select": ["id", "artifactCount"] }
\`\`\`

**3. Invalid operator for type**
\`\`\`json
// Wrong - contains requires string
{ "where": { "state": { "contains": 123 } } }
// Correct
{ "where": { "state": { "contains": "run" } } }
\`\`\`

**4. Missing from field**
\`\`\`json
// Wrong
{ "where": { "state": "completed" } }
// Correct
{ "from": "sessions", "where": { "state": "completed" } }
\`\`\`

**5. Using OR logic (not supported)**
\`\`\`json
// Wrong - no OR support
{ "where": { "$or": [{ "state": "a" }, { "state": "b" }] } }
// Correct - use "in" operator
{ "where": { "state": { "in": ["a", "b"] } } }
\`\`\``;

    default:
      return `## Query Help

Use topic parameter for specific help:
- "where" - Filtering with WHERE clause
- "select" - Projection and field selection
- "operators" - Available filter operators
- "examples" - Common query patterns
- "errors" - Common mistakes to avoid

Quick start:
\`\`\`json
{ "from": "sessions", "limit": 10 }
\`\`\``;
  }
}
