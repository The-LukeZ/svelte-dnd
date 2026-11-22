---
title: Types
description: The default item type.
section: API reference
order: 206
---

<script>
    import ApiTable from "#lib/components/ApiTable.svelte";
</script>

The other exported types are documented next to what uses them: `Options` with [dndzone](/docs/api/options), `DndConfig` and `AriaStrings` with [configure](/docs/api/configure), and `DndEvent`, `DndEventInfo` and `TransformDraggedElementFunction` with the [events](/docs/api/events).

## Item

<ApiTable name="Item" />

Give the zone your own item type instead, and the events and callbacks are typed with it:

```svelte
<script lang="ts">
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    interface Dog {
        id: number;
        name: string;
        breed: string;
    }

    let dogs = $state<Dog[]>([]);

    // e.items is Dog[], and e.info.id is a number
    function update(e: DndEvent<Dog>) {
        dogs = e.items;
    }
</script>

<ul {@attach dndzone(() => ({ items: dogs, onconsider: update, onfinalize: update }))}>
    {#each dogs as dog (dog.id)}
        <li>{dog.name}</li>
    {/each}
</ul>
```
