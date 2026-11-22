---
title: Getting started
description: Install @lukez/svelte-dnd and make a list draggable.
order: 1
---

<script>
    import { Callout, Tabs, TabItem } from "svelte-docsmith";
</script>

`@lukez/svelte-dnd` is a drag and drop library for Svelte 5. You write a list with an `#each` block, put one attachment on its container, and the user can sort it with the pointer, a touch screen or the keyboard.

<Callout variant="warning" title="Prerelease">

The API may change before 1.0. Until then the package is published under the `next` tag.

</Callout>

## Install

<Tabs syncKey="pkg">
<TabItem label="pnpm">

```bash
pnpm add @lukez/svelte-dnd@next
```

</TabItem>
<TabItem label="npm">

```bash
npm install @lukez/svelte-dnd@next
```

</TabItem>
<TabItem label="yarn">

```bash
yarn add @lukez/svelte-dnd@next
```

</TabItem>
</Tabs>

The peer range is `svelte ^5.32.0`, because the library uses attachments. It has no other dependencies.

## A first list

```svelte
<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };

    let items = $state<Task[]>([
        { id: 1, name: "item1" },
        { id: 2, name: "item2" },
        { id: 3, name: "item3" },
        { id: 4, name: "item4" },
    ]);
    const flipDurationMs = 300;

    function update(e: DndEvent<Task>) {
        items = e.items;
    }
</script>

<section {@attach dndzone(() => ({ items, flipDurationMs, onconsider: update, onfinalize: update }))}>
    {#each items as item (item.id)}
        <div animate:flip={{ duration: flipDurationMs }}>{item.name}</div>
    {/each}
</section>
```

Four things make this work:

- `dndzone` is an attachment. It turns the `<section>` into a zone and each of its direct children into a draggable item. It takes a function that returns the options, so it reads your current `items` each time they change.
- Every item has an `id`, and the `#each` block uses it as its key. Keyed blocks are required.
- `onconsider` and `onfinalize` get the event directly. `e.items` is the list the zone should render, and `e.info` says what happened.
- `flipDurationMs` is given to the options and to `animate:flip`, so the library and the animation agree on how long a move takes.

See [Options](/docs/api/options) for every option the getter can return.

## Why you write `items` back twice

The library never changes your list. It tells you what the list should look like, and you assign it:

- `onconsider` runs again and again while the user drags: the item has entered the zone, moved over another index, or left. The `items` it gives you include a temporary placeholder, so the other items make room. Render that list to show the user where the item would land.
- `onfinalize` runs once when the drag ends, in the zone the item was dropped into and in the zone it came from. The `items` it gives you are the final list. This is where you save to a server, or update a store.

Both handlers usually do the same thing, `items = e.items`, so the sample above shares one function. They are two options because they mean different things: a drag in progress and a result. The library relies on both to keep your list in step with the drag, so do not leave either one out. [How it works](/docs/how-it-works) explains the full lifecycle.

## Next steps

- [How it works](/docs/how-it-works): the consider and finalize lifecycle, the placeholder item, zone types and item ids.
- [Options](/docs/api/options): every option of a zone.
