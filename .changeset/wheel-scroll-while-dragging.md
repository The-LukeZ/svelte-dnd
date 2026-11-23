---
"@lukez/svelte-dnd": patch
---

Turning the mouse wheel during a pointer drag now scrolls the scroll container under the dragged element, such as a zone inside a scrollable div. Before, the wheel event hit the dragged element, which lives outside those containers, so only the page could scroll. The shadow item then moves to the item that the scroll brings under the pointer.
