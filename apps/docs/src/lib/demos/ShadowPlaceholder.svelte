<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    // The shadow item is a copy of the dragged item with this flag set while a pointer drag is over the zone.
    type Task = { id: number | string; name: string; isDndShadowItem?: boolean };

    let items = $state<Task[]>([
        { id: 1, name: "Stretch" },
        { id: 2, name: "Walk" },
        { id: 3, name: "Read" },
        { id: 4, name: "Cook" },
    ]);
    const flipDurationMs = 200;
    // The shadow item is in the list during a drag, so leave it out when counting. Check its marker, not its id: the
    // shadow item takes the dragged item's own id during the drag.
    const count = $derived(items.filter((item) => !item.isDndShadowItem).length);

    function update(e: DndEvent<Task>) {
        items = e.items;
    }
</script>

<div class="not-prose flex w-full max-w-sm flex-col gap-3">
    <ul
        aria-label="Habits"
        class="flex flex-col gap-2"
        {@attach dndzone(() => ({ items, flipDurationMs, onconsider: update, onfinalize: update }))}
    >
        {#each items as item (item.id)}
            <!-- The library hides the element of the shadow item. Its children can show again with visibility: visible. -->
            <li
                class="bg-card text-card-foreground relative rounded-md border px-3 py-2"
                animate:flip={{ duration: flipDurationMs }}
            >
                {item.name}
                {#if item.isDndShadowItem}
                    <div
                        class="border-primary text-primary absolute inset-0 visible flex items-center justify-center rounded-md border-2 border-dashed text-sm"
                    >
                        Drop here
                    </div>
                {/if}
            </li>
        {/each}
    </ul>
    <p class="text-muted-foreground text-sm">{count} items, not counting the shadow item.</p>
</div>
