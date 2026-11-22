---
title: Drop target styling
description: "Highlight the zones that can accept the item you are dragging."
section: Demos
order: 108
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import DropTargetStyling from "#lib/demos/DropTargetStyling.svelte";
    import dropTargetStylingSource from "#lib/demos/DropTargetStyling.svelte?source";
</script>

<LiveExample source={dropTargetStylingSource}>
    <DropTargetStyling />
</LiveExample>

While an item is dragged, every zone that can accept it gets the outline from `dropTargetStyle`, and the zones that cannot stay plain. The first list keeps the default outline. The second adds `dropTargetClasses` (Tailwind classes here) and sets `dropTargetStyle` to an empty object, which turns the default outline off. The third replaces the outline and the background through `dropTargetStyle`. The classes and styles are removed again when the drag ends. See the [options](/docs/api/options) for both settings.

The [styling guide](/docs/guides/styling#drop-targets) explains the drop target styles.
