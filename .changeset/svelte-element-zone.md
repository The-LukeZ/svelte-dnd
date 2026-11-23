---
"@lukez/svelte-dnd": patch
---

A zone on a `<svelte:element>` no longer leaves items hidden during and after a pointer drag. Svelte runs the attachment's update before the element's children there, so the shadow item's styling landed on the wrong item. `dndzone` and `dragHandleZone` now hand each update to the zone once the new items are rendered.
