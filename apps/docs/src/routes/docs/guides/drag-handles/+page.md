---
title: Drag handles
description: Let items be dragged only from a grip, so the rest of each item stays free for text selection and clicks.
section: Guides
order: 10
---

By default the whole item starts a drag. With drag handles, only an element you mark inside each item does. Use `dragHandleZone` instead of `dndzone` on the container, and `{@attach dragHandle}` on the handle:

```svelte
<script lang="ts">
    import { flip } from "svelte/animate";
    import { dragHandleZone, dragHandle, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; text: string };

    let items = $state<Task[]>([
        { id: 1, text: "Item 1" },
        { id: 2, text: "Item 2" },
        { id: 3, text: "Item 3" },
    ]);
    const flipDurationMs = 100;

    function update(e: DndEvent<Task>) {
        items = e.items;
    }
</script>

<section {@attach dragHandleZone(() => ({ items, flipDurationMs, onconsider: update, onfinalize: update }))}>
    {#each items as item (item.id)}
        <div class="item" animate:flip={{ duration: flipDurationMs }}>
            <span class="handle" aria-label="Drag handle for {item.text}" {@attach dragHandle}></span>
            <span>{item.text}</span>
        </div>
    {/each}
</section>
```

`dragHandleZone` takes the same [options](/docs/api/options) as `dndzone`, and calls `onconsider` and `onfinalize` the same way.

## How handles behave

- An item of a `dragHandleZone` can only be dragged from a handle inside it. The handle does not have to be a direct child of the item, but it has to be inside it. An item without a handle cannot be dragged.
- The handle starts a drag with the mouse, a touch, or the keyboard drag trigger (Space or Enter by default, see [keyboard and screen readers](/docs/guides/keyboard-and-screen-readers)).
- The handle gets `role="button"`, is a tab stop, and shows a `grab` cursor. The items themselves are not tab stops in a handle zone, so the keyboard reaches the handles instead. Give each handle an `aria-label`, because a screen reader announces it as a button.
- `dragDisabled` on a handle zone turns off the handles of that zone only. Its handles leave the tab order and lose the `grab` cursor.
- A handle outside of any `dragHandleZone` does nothing. With `configure({ debug: true })` the library logs it when the handle is removed.

## Nested handle zones

A handle belongs to the nearest handle zone around it. So a list of groups, where each group is a handle zone of tasks, works without extra setup: the grip of a group drags the group, and the grip of a task drags the task. The [drag handles demo](/docs/demos/drag-handles) is such a list. Give the two levels different `type`s, as with any [nested zones](/docs/guides/nested-zones), so a task cannot land between the groups.

See the [API reference](/docs/api/drag-handles) for both attachments.
