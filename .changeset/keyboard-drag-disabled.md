---
"@lukez/svelte-dnd": minor
---

New zone option `keyboardDragDisabled`: turns keyboard dragging off for a zone and keeps pointer dragging. The zone leaves Space, Enter, the arrow keys and item clicks to the app, does not take items that a keyboard drag tabs into it, and describes itself to screen readers like a zone with `dragDisabled`. In a `dragHandleZone` its handles leave the tab order. It defaults to `false`, so nothing changes for existing zones.
