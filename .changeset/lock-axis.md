---
"@lukez/svelte-dnd": minor
---

New zone option `lockAxis`: `"y"` keeps a pointer drag of the zone's items moving only up and down, `"x"` only left and right. The detection point, auto scrolling and the resizing of the dragged element over items of another size stay on that axis too, and `centreDraggedOnCursor` centres along the free axis only. It is unset by default, so drags stay free.
