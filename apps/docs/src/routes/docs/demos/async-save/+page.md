---
title: Async save
description: "Save the new order on a server and roll back when it fails."
section: Demos
order: 111
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import AsyncSave from "#lib/demos/AsyncSave.svelte";
    import asyncSaveSource from "#lib/demos/AsyncSave.svelte?source";
</script>

<LiveExample source={asyncSaveSource}>
    <AsyncSave />
</LiveExample>

The list only follows the pointer in `onconsider`. The save happens when the drag ends: the list keeps the dropped order, a fake server answers after a short delay, and if the request fails the list goes back to the last saved order. The checkbox makes the server fail so you can watch the rollback, and `dragDisabled` stops a second drag while a save is running. A keyboard drag sends a `finalize` event for every arrow key and ends with an `onconsider` event with the trigger `DRAG_STOPPED`, so the demo checks `e.info.source` and `e.info.trigger` to save once per drop. See the [options](/docs/api/options) and [how it works](/docs/how-it-works) for what the events receive.

The [keyboard guide](/docs/guides/keyboard-and-screen-readers#saving-after-a-drag) explains why a keyboard drag saves on `DRAG_STOPPED`.
