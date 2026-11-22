---
title: Multi-drag
description: "Select several items and drag them together with the mouse or the keyboard."
section: Demos
order: 112
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import MultiDrag from "#lib/demos/MultiDrag.svelte";
    import multiDragSource from "#lib/demos/MultiDrag.svelte?source";
</script>

<LiveExample source={multiDragSource}>
    <MultiDrag />
</LiveExample>

Click an item to select it and Shift-click to select a range. Then drag one of the selected items and the others follow it. When the drag starts, `onconsider` takes the other selected items out of the list and keeps them aside, and when the drop comes they return next to the dragged item. Dropping outside of the zone restores the list. A keyboard drag ends with an `onconsider` event with the trigger `DRAG_STOPPED` rather than `onfinalize`, and the demo handles both. The keyboard works too: Space selects, Shift+Space selects a range and Enter picks up, because the demo moves the drag key to Enter with `configure`. See the [options](/docs/api/options) and [how it works](/docs/how-it-works).

The [keyboard and screen readers guide](/docs/guides/keyboard-and-screen-readers) explains the keyboard drag that this demo builds on.
