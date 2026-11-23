---
"@lukez/svelte-dnd": minor
---

The `onfinalize` events of a pointer drag carry `e.info.pointerPosition`, the `{ x, y }` viewport coordinates of the pointer when the item was dropped. Use it to place a dropped item where it was dropped, for example on a canvas outside of any zone. The property is optional on `DndEventInfo`: `onconsider` events and keyboard drags do not have it.
