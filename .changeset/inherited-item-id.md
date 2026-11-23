---
"@lukez/svelte-dnd": patch
---

An item whose `id` it inherits, such as a getter on its class (RxDB documents, for one), no longer fails the options check with "missing 'id' property". The check used to look for an own property only. The error for an item that really has no id now also reads correctly when the item cannot be turned into JSON, for example because it is circular, instead of throwing "Converting circular structure to JSON".
