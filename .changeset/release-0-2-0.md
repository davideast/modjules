---
'modjules': minor
'@modjules/server': minor
'@modjules/mcp': minor
---

## modjules 0.2.0

### New Features

- **Monorepo architecture**: Core functionality now split into focused packages (`modjules`, `@modjules/server`, `@modjules/mcp`)
- **ChangeSetArtifact**: New `parsed()` method for structured access to file diffs, additions, deletions, and change types

### Improvements

- Re-hydrate artifacts from cache for better performance
- Include full message and artifacts in lightweight responses

## @modjules/mcp 0.2.0

### New MCP Tools

- **jules_get_code_changes**: Retrieve parsed diffs from Jules sessions with file-level breakdown
- **jules_get_bash_outputs**: Get command outputs (test results, build logs) from sessions
- **jules_session_files**: Get overview of all files changed in a session with activity IDs for drill-down

### Improvements

- Sync-then-query pattern documented in tool descriptions
- ASCII tree formatting guidance with emoji color fallback
