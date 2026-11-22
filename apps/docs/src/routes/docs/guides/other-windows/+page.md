---
title: Iframes and other windows
description: "Zones in a same-origin iframe, a popup or another Electron window, run by the library loaded in the main page."
section: Guides
order: 16
---

A zone can live in another window than the one that loaded the library: a same-origin iframe, a popup opened with `window.open`, or another Electron window. Each zone uses its own window's events, timers and document, so drags keep working while the window that loaded the library is in the background. The [iframes and popup demo](/docs/demos/other-windows) shows a page, an iframe and a popup at once.

This is for an app that loads its code in one document and mounts components into others, for example a pop-out editor. An iframe that loads its own app and imports the library there needs nothing from this page: it is an ordinary page with its own copy of the library.

## Mount a component into the other document

Mount the component that holds the zones into the other document's body, and copy your styles there, because a new document has none of the page's stylesheets:

```svelte
<script lang="ts">
    import { mount, unmount } from "svelte";
    import Lists from "./Lists.svelte";

    let popup: Window | null = null;
    let lists: ReturnType<typeof mount> | undefined;

    function openPopup() {
        popup = window.open("", "lists", "width=480,height=600");
        if (!popup) return;
        const doc = popup.document;
        // copy the page's styles, so the component looks the same there
        for (const style of document.querySelectorAll("style, link[rel=stylesheet]")) {
            doc.head.append(style.cloneNode(true));
        }
        lists = mount(Lists, { target: doc.body });
        popup.addEventListener("pagehide", closePopup);
    }

    function closePopup() {
        if (lists) unmount(lists);
        lists = undefined;
        popup?.close();
        popup = null;
    }

    // close the popup when this component is destroyed
    $effect(() => closePopup);
</script>

<button onclick={openPopup}>Open the lists in a popup</button>
```

The same works for a same-origin iframe: mount into `iframe.contentDocument.body`, and unmount when the iframe is removed. Unmount the component when its document goes away, and close a popup when the component that opened it is destroyed.

Mount components, and do not move rendered elements into the other document. Svelte delegates `onclick`, `oninput`, `onkeydown` and similar handlers to the root of the document a component is mounted in, so they never fire on an element that was moved somewhere else.

## Rules

- **Each drag stays in its document.** Pointer and keyboard drags can move items between zones of the same type inside the document they started in. They do not move items between the page and an iframe, between two iframes, or between popups. During a drag in the page, the zones in other documents are not highlighted and do not take the item. The library finds the drop zones of a pointer drag only in the drag's own window, and a keyboard drag that Tab moves into another document ignores the zones there.
- **Ids stay unique across documents.** Item ids must be unique across all zones of a type, including the zones in other documents.
- **Screen readers per document.** Each document with zones gets its own instructions and announcements. For your own announcement about a zone in another document, pass that document: `alertToScreenReader(text, zone.ownerDocument)`.
- **A window that goes away ends the drag.** When a window closes or an iframe is removed during a drag, the drag ends, and the zones get their usual events: `onfinalize` for a pointer drag, and `onconsider` with the `DRAG_STOPPED` trigger for a keyboard drag.
- **Global settings are shared.** `configure` applies to the zones in every document, since there is one copy of the library.
