---
title: Multiple zones and types
description: "Zones that exchange items, and zones that refuse them because of their type."
section: Demos
order: 2
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import MultipleZones from "#lib/demos/MultipleZones.svelte";
    import multipleZonesSource from "#lib/demos/MultipleZones.svelte?source";
</script>

<LiveExample source={multipleZonesSource}>
    <MultipleZones />
</LiveExample>

Each of the four lists is its own zone with its own `items`. The two fruit lists share the `type` `"fruit"` and the two vegetable lists share `"vegetable"`, so an item moves between the lists of its type and is refused by the others. With the keyboard, pick an item up, then Tab to another list of the same type to move it there. See [how it works](/docs/how-it-works) for zone types and the [options](/docs/api/options) for `type`.
