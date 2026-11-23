---
"@lukez/svelte-dnd": patch
---

A zone created while a pointer drag is running, such as the children of a tree node that expands on hover, now takes part in the drag. Before, the library only watched the zones that existed when the drag started, so the new zone got no `onconsider` and could not take the drop. It now also gets the drop target styling.
