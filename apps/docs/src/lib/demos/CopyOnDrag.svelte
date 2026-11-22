<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME, SOURCES, TRIGGERS, type DndEvent } from "@lukez/svelte-dnd";

    type Shape = { id: string; name: string; isDndShadowItem?: boolean };

    const flipDurationMs = 200;

    let palette = $state<Shape[]>([
        { id: "circle", name: "Circle" },
        { id: "square", name: "Square" },
        { id: "triangle", name: "Triangle" },
    ]);
    let canvas = $state<Shape[]>([]);
    let copies = 0;

    function considerPalette(e: DndEvent<Shape>) {
        if (e.info.trigger === TRIGGERS.DRAG_STARTED) {
            // The dragged item is on its way to the canvas, so put a copy with a new id where it was.
            // Without the shadow item in the list, the palette does not keep a hole while you drag.
            const index = palette.findIndex((item) => item.id === e.info.id);
            const copy = { ...palette[index], id: `${palette[index].id}-copy-${++copies}` };
            const rest = e.items.filter((item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
            palette = [...rest.slice(0, index), copy, ...rest.slice(index)];
            return;
        }
        // A keyboard drag that ends inside the palette sends this event, not finalize.
        const stopped = e.info.trigger === TRIGGERS.DRAG_STOPPED;
        palette = stopped ? e.items.filter((item) => item.id !== e.info.id) : e.items;
    }

    function finalizePalette(e: DndEvent<Shape>) {
        // The copy stays in the palette. The dragged item itself never returns to it, even when it is dropped here
        // or outside of every zone. Every arrow key of a keyboard drag sends a finalize event, and that item has to stay.
        palette = e.info.source === SOURCES.POINTER ? e.items.filter((item) => item.id !== e.info.id) : e.items;
    }

    function updateCanvas(e: DndEvent<Shape>) {
        canvas = e.items;
    }
</script>

<div class="not-prose grid w-full gap-4 sm:grid-cols-2">
    <div>
        <h3 class="mb-1 text-sm font-medium">Palette</h3>
        <!-- Items only leave this zone as copies, and nothing can be dropped into it. -->
        <ul
            aria-label="Palette"
            class="flex min-h-32 flex-col gap-2 rounded-md border p-2"
            {@attach dndzone(() => ({
                items: palette,
                flipDurationMs,
                dropFromOthersDisabled: true,
                onconsider: considerPalette,
                onfinalize: finalizePalette,
            }))}
        >
            {#each palette as item (item.id)}
                <li
                    class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                    animate:flip={{ duration: flipDurationMs }}
                >
                    {item.name}
                </li>
            {/each}
        </ul>
    </div>
    <div>
        <h3 class="mb-1 text-sm font-medium">Canvas</h3>
        <ul
            aria-label="Canvas"
            class="flex min-h-32 flex-col gap-2 rounded-md border border-dashed p-2"
            {@attach dndzone(() => ({
                items: canvas,
                flipDurationMs,
                onconsider: updateCanvas,
                onfinalize: updateCanvas,
            }))}
        >
            {#each canvas as item (item.id)}
                <li
                    class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                    animate:flip={{ duration: flipDurationMs }}
                >
                    {item.name}
                </li>
            {/each}
        </ul>
    </div>
</div>
