# modjules

## 1.0.0

### Minor Changes

- [#274](https://github.com/davideast/modjules/pull/274) [`ea9f944`](https://github.com/davideast/modjules/commit/ea9f944632eeb3d0ce10b633c6d9e911b23701bd) Thanks [@davideast](https://github.com/davideast)! - ### Repoless Session Support

  Added support for creating sessions without a GitHub repository:
  - Made `source`, `repo`, and `branch` optional in SDK and MCP
  - Added `changeSet` to `SessionOutput` discriminated union type
  - Exported `parseUnidiff` utility for parsing session output diffs
  - Added `examples/repoless/` with automated/interactive session demos and `niftty` integration for syntax-highlighted diffs

### Patch Changes

- [#274](https://github.com/davideast/modjules/pull/274) [`ea9f944`](https://github.com/davideast/modjules/commit/ea9f944632eeb3d0ce10b633c6d9e911b23701bd) Thanks [@davideast](https://github.com/davideast)! - Replaced pageToken-based cursor with official `create_time` filter for incremental activity sync. This improves reliability since the filter is a stable API parameter rather than relying on the internal pageToken format.

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
