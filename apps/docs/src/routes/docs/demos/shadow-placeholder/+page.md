---
title: Custom shadow placeholder
description: "Draw your own placeholder where the dragged item would land."
section: Demos
order: 107
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import ShadowPlaceholder from "#lib/demos/ShadowPlaceholder.svelte";
    import shadowPlaceholderSource from "#lib/demos/ShadowPlaceholder.svelte?source";
</script>

<LiveExample source={shadowPlaceholderSource}>
    <ShadowPlaceholder />
</LiveExample>

During a pointer drag the zone's `items` contain a shadow item, a copy of the dragged item with `isDndShadowItem` set to `true` and `SHADOW_PLACEHOLDER_ITEM_ID` as its id. The library hides the element of the shadow item, so the demo draws a dashed box in it with `visibility: visible`. The counter filters the shadow item out by its id. Keyboard drags add no shadow item, so the placeholder only shows for the mouse and touch. See [how it works](/docs/how-it-works) for the shadow item and the [options](/docs/api/options) for the zone options.

The [styling guide](/docs/guides/styling#the-shadow-placeholder) explains the placeholder.
