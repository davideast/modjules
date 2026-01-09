# @modjules/mcp

## 1.0.0-beta.1

### Minor Changes

- [#229](https://github.com/davideast/modjules/pull/229) [`f413023`](https://github.com/davideast/modjules/commit/f4130233d393e9fb284ca55cf17a4dde016336c0) Thanks [@davideast](https://github.com/davideast)! - ## modjules 0.2.0

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

### Patch Changes

- Updated dependencies [[`f413023`](https://github.com/davideast/modjules/commit/f4130233d393e9fb284ca55cf17a4dde016336c0)]:
  - modjules@1.0.0-beta.1
