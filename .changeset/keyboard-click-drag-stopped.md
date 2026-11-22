---
"@lukez/svelte-dnd": patch
---

A click on another item during a keyboard drag now ends the drag with an `onconsider` whose trigger is `DRAG_STOPPED` before it starts a drag of the clicked item. Before, the first drag ended without one, so code that saves on `DRAG_STOPPED` missed its moves. No new drag starts if that handler disables dragging in the clicked item's zone or removes the item.
