---
'julets': patch
---

fix: Improved network reliability.

- Implemented robust polling in `NetworkAdapter` to ensure infinite streams never drop connections silently.
- Standardized all internal activity fetching through the new `NetworkClient` interface.
