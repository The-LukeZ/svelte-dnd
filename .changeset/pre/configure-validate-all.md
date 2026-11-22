---
"@lukez/svelte-dnd": patch
---

`configure` now checks every key and value before applying any, so a call that throws no longer leaves some settings changed.
