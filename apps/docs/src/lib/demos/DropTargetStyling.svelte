<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };
    type Panel = { id: string; title: string; note: string; items: Task[] };

    const flipDurationMs = 200;

    // All three zones share the default type, so items travel between them.
    let panels = $state<Panel[]>([
        {
            id: "default",
            title: "Default",
            note: "The default outline",
            items: [
                { id: 1, name: "Item 1" },
                { id: 2, name: "Item 2" },
            ],
        },
        {
            id: "classes",
            title: "Classes",
            note: "dropTargetClasses",
            items: [
                { id: 3, name: "Item 3" },
                { id: 4, name: "Item 4" },
            ],
        },
        {
            id: "style",
            title: "Style",
            note: "dropTargetStyle",
            items: [
                { id: 5, name: "Item 5" },
                { id: 6, name: "Item 6" },
            ],
        },
    ]);

    // The classes and the style are only set while a drag is in progress, on every zone that can accept the item.
    const targets: Record<string, { dropTargetClasses?: string[]; dropTargetStyle?: Record<string, string> }> = {
        default: {},
        // An empty dropTargetStyle turns the default outline off, so only the classes show.
        classes: { dropTargetClasses: ["ring-2", "ring-primary", "bg-primary/10"], dropTargetStyle: {} },
        style: {
            dropTargetStyle: { outline: "2px dashed rebeccapurple", "background-color": "rgb(102 51 153 / 0.12)" },
        },
    };

    function update(panel: Panel, e: DndEvent<Task>) {
        panel.items = e.items;
    }
</script>

<div class="not-prose grid w-full gap-4 sm:grid-cols-3">
    {#each panels as panel (panel.id)}
        <div>
            <h3 class="text-sm font-medium">{panel.title}</h3>
            <p class="text-muted-foreground mb-1 text-xs">{panel.note}</p>
            <ul
                aria-label={panel.title}
                class="flex min-h-32 flex-col gap-2 rounded-md border border-dashed p-2"
                {@attach dndzone(() => ({
                    items: panel.items,
                    flipDurationMs,
                    ...targets[panel.id],
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
