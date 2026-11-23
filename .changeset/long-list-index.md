---
"@lukez/svelte-dnd": patch
---

Faster drag in long lists. Finding the index under the dragged item now measures the scroll containers above the zone once per check, not once per item. In a list of 1600 items ten elements below a scroller, one check went from 23 to 40 ms down to about 10 ms in Chromium.
