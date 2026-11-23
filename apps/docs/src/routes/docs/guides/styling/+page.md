---
title: Styling
description: "Style the zones that can take the dragged item, the element under the pointer and the placeholder where the item would land."
section: Guides
order: 13
---

A pointer drag involves three elements you may want to style: the zones that can take the item, the dragged element that follows the pointer, and the placeholder in the list. Each has a demo: [drop target styling](/demos/drop-target-styling), [custom dragged element](/demos/custom-dragged) and [custom shadow placeholder](/demos/shadow-placeholder).

## Drop targets

While an item is dragged, every zone that can accept it gets the inline styles of `dropTargetStyle` and the classes of `dropTargetClasses`. Both are removed when the drag ends. The default `dropTargetStyle` is a yellow outline, `{ outline: "rgba(255, 255, 102, 0.7) solid 2px" }`.

```svelte
<ul
    {@attach dndzone(() => ({
        items,
        dropTargetStyle: {},
        dropTargetClasses: ["drop-target"],
        onconsider: update,
        onfinalize: update,
    }))}
>
    <!-- ... -->
</ul>

<style>
    :global(.drop-target) {
        outline: 2px dashed royalblue;
    }
</style>
```

- `dropTargetStyle: {}` turns the default outline off.
- The keys of `dropTargetStyle` are CSS property names. They are set as inline styles, so they win over your stylesheets, and at the end of the drag they are set to empty. An inline style of the same property that the zone had before the drag is lost.
- The library adds the classes at runtime, so Svelte does not see them in your markup and removes scoped rules for them. Write the rules with `:global(...)`, in a global stylesheet, or use utility classes such as Tailwind's that exist globally.

A zone can accept the item when it has the same `type` and does not set `dropFromOthersDisabled`. The zone the drag started from is styled too. Keyboard drags style the zones the same way.

## The dragged element

At the start of a pointer drag, the library clones the item's element and appends the clone to the document body, or to the enclosing `<dialog>` or popover. The clone has `position: fixed`, a `z-index` of 9999, a `grabbing` cursor and the id `DRAGGED_ELEMENT_ID` (`"dnd-action-dragged-el"`). The original element is moved out of the list and hidden, and the placeholder in the list is the element your `#each` block renders for the shadow item.

When the clone hovers a zone, it morphs to look like the placeholder there: it takes the placeholder's size, background, padding, font and colors, with a short transition. `morphDisabled: true` keeps the clone's own shape.

There are two ways to style it:

- With CSS, through its id. The clone is not part of any component, so use a global rule:

    ```css
    :global(#dnd-action-dragged-el) {
        box-shadow: 0 8px 20px rgb(0 0 0 / 0.25);
    }
    ```

    The clone keeps the classes of the original element, so rules that match those classes match it too.

- With the `transformDraggedElement` option, a function that receives the clone, the item's data and the index the item would get if it were dropped now. It runs each time the zone renders the placeholder, after the morph, so what it sets wins. It runs again and again, so it should give the same result for the same input.

    ```ts
    function transformDraggedElement(element?: HTMLElement, data?: Task, index?: number) {
        if (!element || !data || index === undefined) return;
        element.style.rotate = "3deg";
        const label = element.querySelector("[data-label]");
        if (label) label.textContent = `${data.name} (#${index + 1})`;
    }
    ```

`centreDraggedOnCursor: true` moves the clone's centre to the cursor when the drag starts, which helps with large items over small ones. `useCursorForDetection: true` uses the cursor instead of the clone's centre to find the zone and index, without moving the clone. `dropAnimationDisabled: true` drops the clone in place instead of animating it to its new position.

`lockAxis` keeps the clone on one axis during a pointer drag: `"y"` moves it only up and down, as in a vertical list, and `"x"` only left and right. The zone and index are found on that axis too, and `centreDraggedOnCursor` centres the clone along the free axis only. The origin zone's setting applies for the whole drag.

## The cursor

The library sets the cursor as an inline style: `grab` on the items of a zone that can be dragged, `grabbing` on the dragged element, and `grab` or `grabbing` on the handles of a `dragHandleZone`. To show another cursor, for example `pointer` on items whose main action is a click, use a rule with `!important`, which wins over the inline style. The dragged element is a copy of the item with the same classes, so exclude it by its id to keep `grabbing` during the drag:

```svelte
<style>
    li:not(#dnd-action-dragged-el) {
        cursor: pointer !important;
    }
</style>
```

To change the cursor of the dragged element, style it through its id, as above: `:global(#dnd-action-dragged-el) { cursor: move !important; }`.

## The shadow placeholder

During a pointer drag, the zone the item hovers renders a [shadow item](/docs/how-it-works#the-shadow-item), marked with `isDndShadowItem: true`. The library sets `visibility: hidden` on its element, so it shows as a gap of the item's size. To draw something in the gap, render the shadow item differently and make your content visible again:

```svelte
<script lang="ts">
    import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from "@lukez/svelte-dnd";
</script>

{#each items as item (item.id)}
    <li>
        {#if item[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
            <div class="placeholder">Drop here</div>
        {:else}
            {item.name}
        {/if}
    </li>
{/each}

<style>
    .placeholder {
        visibility: visible;
        border: 2px dashed currentColor;
    }
</style>
```

Keyboard drags have no shadow item: the item itself moves in the list.
