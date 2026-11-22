---
title: Constants
description: The shadow item marker, the shadow item id and the id of the dragged element.
section: API reference
order: 205
---

<script>
    import ApiTable from "#lib/components/ApiTable.svelte";
</script>

[How it works](/docs/how-it-works#the-shadow-item) explains the shadow item, and the [styling guide](/docs/guides/styling) uses all three.

## SHADOW_ITEM_MARKER_PROPERTY_NAME

<ApiTable name="SHADOW_ITEM_MARKER_PROPERTY_NAME" />

## SHADOW_PLACEHOLDER_ITEM_ID

<ApiTable name="SHADOW_PLACEHOLDER_ITEM_ID" />

The shadow item starts with this id, and takes the dragged item's own id once the dragged element has left the list. To recognise the shadow item, check `SHADOW_ITEM_MARKER_PROPERTY_NAME` instead.

## DRAGGED_ELEMENT_ID

<ApiTable name="DRAGGED_ELEMENT_ID" />
