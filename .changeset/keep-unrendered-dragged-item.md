---
"@lukez/svelte-dnd": patch
---

A drop no longer removes the dragged item's element from a zone that never re-rendered it away, for example when its items are not reactive or its `#each` block is not keyed.
