---
"@lukez/svelte-dnd": patch
---

A zone created with a different `type` on an element during the drop animation of a drag from the previous zone on it no longer leaves the old type registered, which kept `configure({ idKey })` throwing and broke the next drag of that type.
