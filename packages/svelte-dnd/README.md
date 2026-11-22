# @lukez/svelte-dnd

Drag and drop for Svelte 5: rich animations, nested containers, touch, keyboard and screen reader support.

**Docs:** https://svelte-dnd.thelukez.com

## Install

```bash
pnpm add @lukez/svelte-dnd
```

Requires `svelte ^5.32.0`.

## Usage

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

The [getting started guide](https://svelte-dnd.thelukez.com/docs/getting-started) explains how this works.

## Links

- [Documentation](https://svelte-dnd.thelukez.com)
- [Migrating from `svelte-dnd-action`](https://svelte-dnd.thelukez.com/docs/migrating)
- [Changelog](https://github.com/The-LukeZ/svelte-dnd/blob/master/packages/svelte-dnd/CHANGELOG.md)

## Credits and license

`@lukez/svelte-dnd` is a fork of [`svelte-dnd-action`](https://github.com/isaacHagoel/svelte-dnd-action) by Isaac Hagoel. MIT licensed, see [`LICENSE`](./LICENSE).
