---
'modjules': patch
---

Replaced pageToken-based cursor with official `create_time` filter for incremental activity sync. This improves reliability since the filter is a stable API parameter rather than relying on the internal pageToken format.
