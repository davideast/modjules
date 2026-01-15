---
'modjules': minor
---

### Repoless Session Support

Added support for creating sessions without a GitHub repository:

- Made `source`, `repo`, and `branch` optional in SDK and MCP
- Added `changeSet` to `SessionOutput` discriminated union type
- Exported `parseUnidiff` utility for parsing session output diffs
- Added `examples/repoless/` with automated/interactive session demos and `niftty` integration for syntax-highlighted diffs
