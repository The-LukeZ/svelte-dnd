---
"@lukez/svelte-dnd": patch
---

A zone on a `<svelte:element>` no longer leaves items hidden during and after a pointer drag. Svelte runs the attachment's update before the element's children there, so the shadow item's styling landed on the wrong item. `dndzone` and `dragHandleZone` now hand each update to the zone in a microtask, once Svelte has rendered the new items. This changes the timing on every element, not only on `<svelte:element>`:

- The first options apply at once, when the zone is created. Right after a later state change, even after `flushSync()`, the zone still works with its previous options. It has the new ones from the next microtask on: `await tick()` after the change is enough. Several updates in one flush reach the zone as one update with the latest options.
- The options are still checked when they are given, so an invalid option, such as an item without an id, still throws from the attachment's effect, where a `<svelte:boundary>` can catch it. An error the zone throws later while it applies valid options has no caller in the microtask, and is reported to the window's `error` event instead.
