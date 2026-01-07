# MCP Tool Reference

This document provides a comprehensive reference for every tool exposed by the `modjules` MCP server.

---

## Session Management

### `jules_create_session`
Creates a new Jules session or automated run.

**Parameters:**
- `prompt` (string, **required**): The task for the agent.
- `repo` (string, **required**): The GitHub repository in `owner/repo` format.
- `branch` (string, **required**): The target branch for the work.
- `interactive` (boolean, optional): If `true`, the session will pause for plan approval. Defaults to `false`.
- `autoPr` (boolean, optional): If `true`, a pull request will be created on completion. Defaults to `true`.

**Returns:**
A string confirming the creation and providing the `sessionId`.
```json
{
  "content": [{ "type": "text", "text": "Session created. ID: 12345" }]
}
```

---

### `jules_list_sessions`
Lists recent Jules sessions from the local cache.

**Parameters:**
- `pageSize` (number, optional): The number of sessions to return. Defaults to `10`.

**Returns:**
An array of `SessionResource` objects.

---

### `jules_session_state`
Returns lightweight, high-level metadata about a specific session.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session to query.

**Returns:**
A JSON object with the session's current state.

---

### `jules_session_timeline`
Returns a paginated list of lightweight activities (events) for a session.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session.
- `limit` (number, optional): Max activities to return. Default: `10`.
- `order` (string, optional): Sort order. `asc` or `desc` (default).
- `type` (string, optional): Filter by a specific activity type.
- `startAfter` (string, optional): An activity ID to use as a cursor for pagination.

**Returns:**
A list of summarized activities and pagination info.

---

### `jules_interact`
Interacts with an active session by approving a plan or sending a message.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session.
- `action` (string, **required**): The action to perform. Must be one of `approve`, `send`, or `ask`.
- `message` (string, optional): The message content. **Required** if the action is `send` or `ask`.

**Returns:**
A confirmation message or the agent's reply for the `ask` action.

---

### `jules_get_session_analysis_context`
Returns a comprehensive, structured snapshot of a session, optimized for LLM analysis.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session to analyze.

**Returns:**
A large text context block containing the full session analysis.

---
## Data & Querying

### `jules_sync`
Fetches new data from the Jules API and updates the local cache.

**Parameters:**
- `sessionId` (string, optional): If provided, syncs only that session. If omitted, syncs all recent sessions.
- `depth` (string, optional): `metadata` (default) or `activities`.

**Returns:**
A JSON object with statistics about the sync operation.

---

### `jules_select`
Performs a complex query against the **local cache**.

**Parameters:**
- `query` (object, **required**): The JQL query object.
  - `from` (string, **required**): `sessions` or `activities`.
  - `where` (object, optional): Filters.
  - `select` (array, optional): Fields to return.
  - `limit` (number, optional): Max results.
  - `tokenBudget` (number, optional): Truncates results to a token limit.

**Returns:**
A JSON object containing the query results.

---

### `jules_schema`
Returns the schema for the queryable domains (`sessions` and `activities`).

**Parameters:**
- `domain` (string, optional): `sessions`, `activities`, or `all` (default).
- `format` (string, optional): `json` (default) or `markdown`.

---

### `jules_query_help`
Provides LLM-optimized documentation for constructing JQL queries.

**Parameters:**
- `topic` (string, optional): `where`, `select`, `operators`, `examples`, or `errors`.

---

### `jules_validate_query`
Validates a JQL query before executing it.

**Parameters:**
- `query` (object, **required**): The JQL query object to validate.

**Returns:**
A validation result with an array of errors and warnings.

---
## Code & Artifact Analysis

### `jules_session_files`
Lists a summary of all files that were changed in a given session.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session.

**Returns:**
A list of files, including the type of change and `activityId`s.

---

### `jules_get_code_changes`
Gets the detailed diff for a specific file change.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session.
- `activityId` (string, **required**): The ID of the activity containing the change.
- `filePath` (string, optional): A specific file to get the diff for.

**Returns:**
A JSON object containing the `unidiffPatch` string.

---

### `jules_get_bash_outputs`
Gets all shell command outputs from a session.

**Parameters:**
- `sessionId` (string, **required**): The ID of the session.

**Returns:**
A list of all the bash commands that were run.
