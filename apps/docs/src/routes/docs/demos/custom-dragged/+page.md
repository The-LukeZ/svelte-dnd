---
title: Custom dragged element
description: "Change how the element under the pointer looks with transformDraggedElement."
section: Demos
order: 106
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import CustomDragged from "#lib/demos/CustomDragged.svelte";
    import customDraggedSource from "#lib/demos/CustomDragged.svelte?source";
</script>

<LiveExample source={customDraggedSource}>
    <CustomDragged />
</LiveExample>

While a pointer drag is running, `transformDraggedElement` receives the element that follows the pointer, the item's data and the index it would land at. Here it tilts the element, adds a shadow and an outline, and writes the target position into its label (a number sign and the position). It runs after the library has copied the placeholder's styles onto the element, so what it sets wins, and it runs again on every update, so it must give the same result each time. The checkbox sets `centreDraggedOnCursor`. See the [options](/docs/api/options) for both options and [how it works](/docs/how-it-works) for the placeholder.

The [styling guide](/docs/guides/styling#the-dragged-element) explains the dragged element.
