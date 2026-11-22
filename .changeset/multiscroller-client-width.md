---
"@lukez/svelte-dnd": patch
---

A pointer drag now scrolls a page that only overflows horizontally when the page's scroll width is not more than the window's height, as in a portrait window. Before, the check compared the scroll width with the client height.
