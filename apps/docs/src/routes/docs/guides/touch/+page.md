---
title: Touch
description: "Drag on touch screens without taking over the page scroll."
section: Guides
order: 14
---

Zones work with touch out of the box. A touch on an item starts a drag as soon as the finger moves a few pixels, and the page does not scroll while the finger is on an item. On a long list or a page that scrolls, that can turn a quick swipe into a drag.

## Delay the start of a drag

`delayTouchStart` makes the user hold the item before the drag starts. A finger that moves away before the delay scrolls the page as usual:

```svelte
<section
    {@attach dndzone(() => ({ items, flipDurationMs, delayTouchStart: true, onconsider: update, onfinalize: update }))}
>
    <!-- ... -->
</section>
```

- `true` waits 80 ms.
- A number waits that many milliseconds, for example `delayTouchStart: 200`.
- `false`, the default, starts the drag as soon as the touch moves.

The delay applies only to touch. A mouse drag still starts as soon as the mouse moves.

## Drag handles on touch screens

[Drag handles](/docs/guides/drag-handles) are another fix: only the handle starts a drag, so a swipe anywhere else on the item scrolls the page. The [drag handles demo](/demos/drag-handles) works with touch. Try the [basic list](/demos/basic) on a phone to compare.

Scrolling during a drag works the same as with the mouse: hold the item near the edge of a scrolling list or of the screen. See [scrolling](/docs/guides/scrolling).
