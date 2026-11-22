---
title: Basic list
description: "A sortable list with a switch for the flip animation."
section: Demos
order: 101
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import Basic from "#lib/demos/Basic.svelte";
    import basicSource from "#lib/demos/Basic.svelte?source";
</script>

<LiveExample source={basicSource}>
    <Basic />
</LiveExample>

This is the smallest useful zone. `dndzone` makes the `ul` a zone and each `li` an item, and both `onconsider` and `onfinalize` write `e.items` back to `items`. The checkbox changes `flipDurationMs` between `0` and `200`: with `0` the items jump into place, with `200` they slide. Use the mouse, a touch screen, or focus an item, press Space, move it with the arrow keys and press Space again. See [how it works](/docs/how-it-works) for the lifecycle and the [options](/docs/api/options) for `flipDurationMs`.

On a touch screen, see the [touch guide](/docs/guides/touch) for a delay before a drag starts.
