---
title: Copy on drag
description: "Drag copies out of a palette and leave the originals in place."
section: Demos
order: 109
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import CopyOnDrag from "#lib/demos/CopyOnDrag.svelte";
    import copyOnDragSource from "#lib/demos/CopyOnDrag.svelte?source";
</script>

<LiveExample source={copyOnDragSource}>
    <CopyOnDrag />
</LiveExample>

The palette keeps its shapes while you drag them to the canvas. When a drag starts, `onconsider` sees the trigger `DRAG_STARTED`, finds the item with `e.info.id` and puts a copy with a new id at the same index, in a list without the shadow item, so the palette shows no gap. The dragged item keeps its original id and lands on the canvas, because ids have to stay unique. `dropFromOthersDisabled` stops anything from being dropped back into the palette. See the [options](/docs/api/options) for it, and [how it works](/docs/how-it-works) for the shadow item.

The [recipes](/docs/recipes#copy-on-drop-into-a-single-slot) show a copy on drop into a slot that holds one item.
