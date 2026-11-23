---
"@lukez/svelte-dnd": minor
---

`configure` takes two new global settings for the auto-scroll of a pointer drag: `autoScrollEdgePx` sets how close to the edge of a scrolling container or the page scrolling starts, and `autoScrollMaxStepPx` sets how many pixels it scrolls per frame with the pointer at the edge. Both default to 30, which keeps the current behaviour, and `null` restores the default.
