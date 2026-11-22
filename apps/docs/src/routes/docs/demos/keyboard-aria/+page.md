---
title: Keyboard and custom aria
description: "Keyboard drags, your own screen reader strings and the key that starts a drag."
section: Demos
order: 5
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import KeyboardAria from "#lib/demos/KeyboardAria.svelte";
    import keyboardAriaSource from "#lib/demos/KeyboardAria.svelte?source";
</script>

<LiveExample source={keyboardAriaSource}>
    <KeyboardAria />
</LiveExample>

Press Space or Enter on an item to pick it up, move it with the arrow keys, press Tab to carry it to the other list, and press the key again to drop it. The demo replaces every screen reader string with `configure({ ariaStrings })` and shows each announcement under the lists, and the select changes the drag keys with `configure({ keyboardDragTrigger })`. The `aria-label` of each zone and item is what the announcements call it, and the locked list has `dragDisabled`, so it gets its own instruction. See the [options](/docs/api/options) for `dragDisabled` and the other options of a zone.
