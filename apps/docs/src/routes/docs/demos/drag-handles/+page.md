---
title: Drag handles
description: "Items that can only be dragged from a grip, with handle zones nested inside each other."
section: Demos
order: 4
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import DragHandles from "#lib/demos/DragHandles.svelte";
    import dragHandlesSource from "#lib/demos/DragHandles.svelte?source";
</script>

<LiveExample source={dragHandlesSource}>
    <DragHandles />
</LiveExample>

`dragHandleZone` replaces `dndzone`, and `dragHandle` marks the element that starts the drag, which here is the grip of each item. The text of the items can be selected, and a drag only starts from a grip. The groups and the tasks inside them are both handle zones: each grip belongs to the nearest handle zone around it. The grips take the keyboard focus, so Tab to one, press Space, use the arrow keys and press Space again. See the [options](/docs/api/options) for the options of both zones.
