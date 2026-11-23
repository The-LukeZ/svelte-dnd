---
"@lukez/svelte-dnd": patch
---

A zone created while a pointer drag is running, such as the children of a tree node that expands on hover, now takes part in the drag. Before, the library only watched the zones that existed when the drag started, so the new zone got no `onconsider` and could not take the drop. It now also gets the drop target styling, and a longer `flipDurationMs` of its own slows the drag detection down to it, as it does for the zones there at the start, so its items do not jump back and forth.
