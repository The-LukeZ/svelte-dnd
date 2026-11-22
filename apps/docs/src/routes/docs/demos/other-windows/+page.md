---
title: Iframes and popup
description: "Zones in a same-origin iframe and in a popup window, run by the library loaded in this page."
section: Demos
order: 13
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import OtherWindows from "#lib/demos/OtherWindows.svelte";
    import otherWindowsSource from "#lib/demos/OtherWindows.svelte?source";
</script>

<LiveExample source={otherWindowsSource}>
    <OtherWindows />
</LiveExample>

The library and the component are loaded once, in this page. The component renders two boards of two lists each, one in the page and one moved into a same-origin `iframe`, and a third board, moved into a popup, once the "Open popup" button opens one with `window.open`. A zone works with its own document and window, so the lists in the iframe and the popup follow that document's pointer and keyboard events, get their own screen reader instructions and announcements, and keep working while this page is in the background. The iframe and the popup get copies of the page's stylesheets and theme class, because the elements keep the page's class names. Moving rendered elements is a shortcut that keeps this demo to one file, and it has a catch: Svelte delegates `onclick`, `oninput`, `onkeydown` and similar handlers to the page, so they never fire on moved elements. In an app, mount a component into the other document with `mount(Lists, { target: otherDoc.body })`, copy its styles there, and `unmount` it when the iframe or popup goes away.

Each drag stays in the document it started in. Drag between the two lists of one board, with the mouse, a touch screen or the keyboard (focus an item, press Space, move it with the arrow keys or Tab to the other list, press Space again). A drag in the page does not offer the iframe or popup lists as destinations, and the other way round. Item ids stay unique across all the zones of a type, even across documents. Closing the popup removes its lists, and leaving this page closes the popup. See [how it works](/docs/how-it-works) for the lifecycle and the [options](/docs/api/options) for `type`.
