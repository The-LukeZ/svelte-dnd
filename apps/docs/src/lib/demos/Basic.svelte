<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };

    let items = $state<Task[]>([
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
        { id: 3, name: "Item 3" },
        { id: 4, name: "Item 4" },
        { id: 5, name: "Item 5" },
    ]);
    let animate = $state(true);
    const flipDurationMs = $derived(animate ? 200 : 0);

    function update(e: DndEvent<Task>) {
        items = e.items;
    }
</script>

<div class="not-prose flex w-full max-w-xs flex-col gap-3">
    <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={animate} />
        Animate
    </label>
    <ul
        aria-label="Basic list"
        class="flex flex-col gap-2"
        {@attach dndzone(() => ({ items, flipDurationMs, onconsider: update, onfinalize: update }))}
    >
        {#each items as item (item.id)}
            <li
                class="bg-card text-card-foreground rounded-md border px-3 py-2"
                animate:flip={{ duration: flipDurationMs }}
            >
                {item.name}
            </li>
        {/each}
    </ul>
</div>
