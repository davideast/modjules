# modjules

## 1.0.0

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

- [#260](https://github.com/davideast/modjules/pull/260) [`ce4ae40`](https://github.com/davideast/modjules/commit/ce4ae403cb9941176599594172b84915189c8087) Thanks [@davideast](https://github.com/davideast)! - ## Repoless Sessions Support

  Added support for creating Jules sessions without attaching them to a GitHub repository ("repoless sessions"). These sessions are useful for:
  - General coding questions and discussions
  - Code review assistance without repo context
  - Learning and exploration tasks

  ### Features
  - **SDK (modjules)**: Made `source` property optional in `SessionConfig`. Sessions created without source will be repoless.
  - **MCP (@modjules/mcp)**: Made `repo` and `branch` optional in `jules_create_session` tool. Updated tool description to document repoless sessions.
  - **Session Outputs**: Added support for `changeSet` outputs (in addition to `pullRequest`) for retrieving generated code from repoless sessions.
  - **Utility Export**: Exported `parseUnidiff` utility for parsing unified diffs from session outputs.

  ### New Example

  Added `examples/repoless/` demonstrating:
  - Automated and interactive repoless session modes
  - Session resumption by ID
  - TUI-formatted activity logging
  - Automatic saving of changeSet artifacts
