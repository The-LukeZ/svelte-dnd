<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Entry = { id: number; name: string };
    type Zone = { id: string; title: string; type: "fruit" | "vegetable"; items: Entry[] };

    const flipDurationMs = 200;

    // Item ids only have to be unique among the zones of the same type, but unique overall is simpler.
    let zones = $state<Zone[]>([
        {
            id: "fruit-a",
            title: "Fruit basket",
            type: "fruit",
            items: [
                { id: 1, name: "Apple" },
                { id: 2, name: "Banana" },
                { id: 3, name: "Cherry" },
            ],
        },
        { id: "fruit-b", title: "Fruit bowl", type: "fruit", items: [{ id: 4, name: "Mango" }] },
        {
            id: "vegetable-a",
            title: "Vegetable crate",
            type: "vegetable",
            items: [
                { id: 5, name: "Carrot" },
                { id: 6, name: "Leek" },
            ],
        },
        { id: "vegetable-b", title: "Vegetable drawer", type: "vegetable", items: [{ id: 7, name: "Beet" }] },
    ]);

    function update(zone: Zone, e: DndEvent<Entry>) {
        zone.items = e.items;
    }
</script>

<div class="not-prose grid w-full gap-4 sm:grid-cols-2">
    {#each zones as zone (zone.id)}
        <div>
            <h3 class="mb-1 text-sm font-medium">{zone.title}</h3>
            <ul
                aria-label={zone.title}
                class="flex min-h-32 flex-col gap-2 rounded-md border border-dashed p-2"
                {@attach dndzone(() => ({
                    items: zone.items,
                    type: zone.type,
                    flipDurationMs,
                    onconsider: (e) => update(zone, e),
                    onfinalize: (e) => update(zone, e),
                }))}
            >
                {#each zone.items as item (item.id)}
                    <li
                        class="bg-card text-card-foreground rounded-md border px-3 py-2"
                        animate:flip={{ duration: flipDurationMs }}
                    >
                        {item.name}
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
</div>
