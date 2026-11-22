---
title: dndzone and options
description: The dndzone attachment and the options of a dndzone or a dragHandleZone.
section: API reference
order: 201
---

<script>
    import ApiTable from "#lib/components/ApiTable.svelte";
</script>

A zone takes a function that returns its options, and reads it again whenever the state it reads changes. Every option except `items` is optional. The [getting started](/docs/getting-started) page shows a full example, and [how it works](/docs/how-it-works) explains the events.

## dndzone

<ApiTable name="dndzone" />

## Options

`dragHandleZone` takes the same options. See [drag handles](/docs/api/drag-handles).

<ApiTable name="Options" />

`useComputedStyleForRects` replaces the `USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT` feature flag of `svelte-dnd-action`. It is set per zone, and most apps do not need it.
