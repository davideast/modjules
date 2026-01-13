# modjules

## 0.4.1

### Patch Changes

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
