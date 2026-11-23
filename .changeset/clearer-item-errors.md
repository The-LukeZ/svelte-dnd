---
"@lukez/svelte-dnd": patch
---

Clearer errors for invalid `items`. A non-array `items` now throws "dndzone expects 'items' to be an array" instead of "items.find is not a function". A `null` or non-object item throws the missing id error instead of a `TypeError`. The missing id error now gives the item's index and points to `configure({ idKey })`.
