---
"@lukez/svelte-dnd": patch
---

`useComputedStyleForRects` now also applies when a pointer drag starts: the dragged clone takes the item's computed width, height and box-sizing instead of its bounding rect. Before, the clone was sized from the rect at drag start, and the option only took effect on the first morph.
