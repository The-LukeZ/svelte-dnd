---
title: Enable and disable
description: "Turn dragging and dropping on and off per list."
section: Demos
order: 110
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import EnableDisable from "#lib/demos/EnableDisable.svelte";
    import enableDisableSource from "#lib/demos/EnableDisable.svelte?source";
</script>

<LiveExample source={enableDisableSource}>
    <EnableDisable />
</LiveExample>

Each list has two switches. Locking the items sets `dragDisabled` for that zone, so its items cannot be picked up with the mouse, a touch or the keyboard, while the other list still accepts them. Turning off "Accept items from the other list" sets `dropFromOthersDisabled`, so the zone refuses items from elsewhere but its own items still reorder. Try locking one list and blocking the other to see how the two settings combine. See the [options](/docs/api/options) for `dragDisabled` and `dropFromOthersDisabled`.
