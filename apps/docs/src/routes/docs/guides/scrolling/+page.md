---
title: Scrolling
description: "How a pointer drag scrolls lists, their containers and the page when the item reaches an edge."
section: Guides
order: 15
---

During a pointer drag, the library scrolls for the user: hold the dragged item near the edge of a scrolling container and the container scrolls in that direction. It scrolls faster the closer the pointer gets to the edge. The [board demo](/demos/board) has a column that scrolls, a board that scrolls sideways, and a page that scrolls.

## What scrolls

When a drag starts, the library looks at every zone of the dragged item's `type` in the same document, and collects:

- each of those zones and their ancestors whose `overflow` is `auto` or `scroll`,
- the page (the document's scrolling element), when it is taller than the window.

Each of these scrolls when the pointer is inside it and within 30 pixels of one of its edges. Nested containers scroll from the innermost one out. There is no option to set up: give a list `overflow: auto` and a fixed height, and it scrolls during a drag.

```svelte
<ul
    style="max-height: 16rem; overflow-y: auto"
    {@attach dndzone(() => ({ items, onconsider: update, onfinalize: update }))}
>
    <!-- ... -->
</ul>
```

Scrolling follows the pointer, not the dragged element, so an item grabbed at its edge scrolls when the pointer reaches the edge of the container.

## Keyboard drags

Auto-scroll is for pointer drags. During a keyboard drag the moved item keeps the focus, and the browser scrolls a focused element into view.

## Scrolling inside an item

An item that scrolls on its own, such as a card with a long text, does not keep its scroll position through a drag: the dragged element is a copy that starts at the top, and an item dropped into another zone is a new element. The [recipes](/docs/recipes#keep-the-scroll-position-of-a-draggable) show how to keep it.
