---
title: Recipes
description: "Code for a single-slot drop area that copies, a reusable list component, and items that keep their own scroll position."
section: Guides
order: 18
---

Short patterns that have no demo of their own. Each is a complete component you can copy.

## Copy on drop into a single slot

A palette of colors and a slot that holds one of them. Dropping a color into the slot puts a copy there, with a new id, and the palette keeps all of its colors. A new drop replaces what the slot holds, and dragging the slot's color back to the palette clears the slot.

```svelte
<script lang="ts">
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Color = { id: number; name: string; isDndShadowItem?: boolean };

    const colors: Color[] = [
        { id: 1, name: "Red" },
        { id: 2, name: "Green" },
        { id: 3, name: "Blue" },
    ];
    let nextId = 100;

    let palette = $state<Color[]>([...colors]);
    let slot = $state<Color[]>([]);

    function considerPalette(e: DndEvent<Color>) {
        palette = e.items;
    }

    function finalizePalette() {
        // whatever happened, the palette keeps every color in its order
        palette = [...colors];
    }

    function considerSlot(e: DndEvent<Color>) {
        // while a color hovers the slot, show only the shadow item, so the slot never holds two
        const incoming = e.items.filter((color) => color.isDndShadowItem);
        slot = incoming.length > 0 ? incoming : e.items;
    }

    function finalizeSlot(e: DndEvent<Color>) {
        // keep the dropped color only, as a copy with its own id
        slot = e.items.filter((color) => color.id === e.info.id).map((color) => ({ ...color, id: nextId++ }));
    }
</script>

<ul
    aria-label="Palette"
    {@attach dndzone(() => ({ items: palette, onconsider: considerPalette, onfinalize: finalizePalette }))}
>
    {#each palette as color (color.id)}
        <li aria-label={color.name}>{color.name}</li>
    {/each}
</ul>

<div
    aria-label="Slot"
    class="slot"
    {@attach dndzone(() => ({ items: slot, onconsider: considerSlot, onfinalize: finalizeSlot }))}
>
    {#each slot as color (color.id)}
        <div aria-label={color.name}>{color.name}</div>
    {/each}
</div>

<style>
    .slot {
        min-height: 3rem;
        border: 2px dashed gray;
    }
</style>
```

The copy gets a new id because ids must be unique across all zones of a type. The [copy on drag demo](/docs/demos/copy-on-drag) copies at the start of the drag instead: it puts a copy back into the palette as soon as the drag starts, so the palette has no gap while you drag.

## A generic list component

A zone is an attachment, so a list component that you reuse with different item markup takes the markup as a snippet:

```svelte
<!-- DndList.svelte -->
<script lang="ts" generics="T extends { id: string | number }">
    import type { Snippet } from "svelte";
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    let {
        items = $bindable(),
        item,
        type,
        flipDurationMs = 200,
    }: {
        items: T[];
        item: Snippet<[T]>;
        type?: string;
        flipDurationMs?: number;
    } = $props();

    function update(e: DndEvent<T>) {
        items = e.items;
    }
</script>

<ul {@attach dndzone(() => ({ items, type, flipDurationMs, onconsider: update, onfinalize: update }))}>
    {#each items as entry (entry.id)}
        <li animate:flip={{ duration: flipDurationMs }}>{@render item(entry)}</li>
    {/each}
</ul>
```

Use it with `bind:items` and an `item` snippet:

```svelte
<script lang="ts">
    import DndList from "./DndList.svelte";

    let tasks = $state([
        { id: 1, name: "Write the docs", done: false },
        { id: 2, name: "Ship it", done: false },
    ]);
</script>

<DndList bind:items={tasks}>
    {#snippet item(task)}
        <label><input type="checkbox" bind:checked={task.done} /> {task.name}</label>
    {/snippet}
</DndList>
```

The component owns the `#each` block and the zone, so the rules of a zone hold: one element per item, keyed by its id. The snippet renders what goes inside each item.

## Keep the scroll position of a draggable

An item that scrolls on its own loses its scroll position in a drag: the dragged element is a copy that starts at the top, and an item dropped into another zone is a new element. Keep the position in the item's data, as every piece of state that should survive a drag, and restore it in two places:

```svelte
<script lang="ts">
    import { untrack } from "svelte";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Note = { id: number; text: string; scrollTop: number };

    let notes = $state<Note[]>([
        { id: 1, text: "A long note...", scrollTop: 0 },
        { id: 2, text: "Another long note...", scrollTop: 0 },
    ]);

    function update(e: DndEvent<Note>) {
        notes = e.items;
    }

    // Restores the position when the element is created, also after a drop into another zone.
    // untrack, so scrolling does not run the attachment again.
    function keepScroll(note: Note) {
        return (element: HTMLElement) => {
            element.scrollTop = untrack(() => note.scrollTop);
        };
    }

    // The dragged element is a copy, so give it the position too.
    function transformDraggedElement(element?: HTMLElement, note?: Note) {
        const body = element?.querySelector<HTMLElement>(".note-body");
        if (body && note) body.scrollTop = note.scrollTop;
    }
</script>

<ul {@attach dndzone(() => ({ items: notes, transformDraggedElement, onconsider: update, onfinalize: update }))}>
    {#each notes as note (note.id)}
        <li>
            <div
                class="note-body"
                onscroll={(e) => (note.scrollTop = e.currentTarget.scrollTop)}
                {@attach keepScroll(note)}
            >
                {note.text}
            </div>
        </li>
    {/each}
</ul>

<style>
    .note-body {
        height: 6rem;
        overflow-y: auto;
    }
</style>
```

See [scrolling](/docs/guides/scrolling) for how a drag scrolls the containers around the zones.
