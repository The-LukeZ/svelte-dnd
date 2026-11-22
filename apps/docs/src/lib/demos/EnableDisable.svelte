<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };
    type Panel = {
        id: string;
        title: string;
        items: Task[];
        // The two switches for this zone.
        locked: boolean;
        acceptsDrops: boolean;
    };

    const flipDurationMs = 200;

    // Both zones share the default type, so items can move between them while both allow it.
    let panels = $state<Panel[]>([
        {
            id: "left",
            title: "Left list",
            items: [
                { id: 1, name: "Item 1" },
                { id: 2, name: "Item 2" },
                { id: 3, name: "Item 3" },
            ],
            locked: false,
            acceptsDrops: true,
        },
        {
            id: "right",
            title: "Right list",
            items: [
                { id: 4, name: "Item 4" },
                { id: 5, name: "Item 5" },
            ],
            locked: false,
            acceptsDrops: true,
        },
    ]);

    function update(panel: Panel, e: DndEvent<Task>) {
        panel.items = e.items;
    }
</script>

<div class="not-prose grid w-full gap-4 sm:grid-cols-2">
    {#each panels as panel (panel.id)}
        <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium">{panel.title}</h3>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={panel.locked} />
                Lock the items
            </label>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={panel.acceptsDrops} />
                Accept items from the other list
            </label>
            <!-- dragDisabled stops this zone's items from being dragged. dropFromOthersDisabled stops items from other zones from landing here. -->
            <ul
                aria-label={panel.title}
                class="flex min-h-32 flex-col gap-2 rounded-md border border-dashed p-2 {panel.locked
                    ? 'opacity-60'
                    : ''}"
                {@attach dndzone(() => ({
                    items: panel.items,
                    flipDurationMs,
                    dragDisabled: panel.locked,
                    dropFromOthersDisabled: !panel.acceptsDrops,
                    onconsider: (e) => update(panel, e),
                    onfinalize: (e) => update(panel, e),
                }))}
            >
                {#each panel.items as item (item.id)}
                    <li
                        class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                        animate:flip={{ duration: flipDurationMs }}
                    >
                        {item.name}
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
</div>
