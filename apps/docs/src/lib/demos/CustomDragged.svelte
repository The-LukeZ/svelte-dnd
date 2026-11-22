<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };

    let items = $state<Task[]>([
        { id: 1, name: "Pack the bag" },
        { id: 2, name: "Charge the phone" },
        { id: 3, name: "Check the weather" },
        { id: 4, name: "Lock the door" },
    ]);
    let centre = $state(false);
    const flipDurationMs = 200;

    function update(e: DndEvent<Task>) {
        items = e.items;
    }

    // Runs on every update of the dragged element, after the library has copied the placeholder's styles onto it,
    // so what it sets wins. It must give the same result when it runs again.
    function transformDraggedElement(element?: HTMLElement, data?: Task, index?: number) {
        if (!element || !data || index === undefined) return;
        element.style.rotate = "3deg";
        element.style.boxShadow = "0 8px 20px rgb(0 0 0 / 0.25)";
        element.style.outline = "2px solid var(--primary)";
        element.style.whiteSpace = "nowrap";
        const label = element.querySelector("[data-label]");
        if (label) label.textContent = `${data.name} (#${index + 1})`;
    }
</script>

<div class="not-prose flex w-full max-w-sm flex-col gap-3">
    <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={centre} />
        Centre the dragged element on the cursor
    </label>
    <ul
        aria-label="Tasks"
        class="flex flex-col gap-2"
        {@attach dndzone(() => ({
            items,
            flipDurationMs,
            centreDraggedOnCursor: centre,
            transformDraggedElement,
            onconsider: update,
            onfinalize: update,
        }))}
    >
        {#each items as item (item.id)}
            <li
                class="bg-card text-card-foreground rounded-md border px-3 py-2"
                animate:flip={{ duration: flipDurationMs }}
            >
                <span data-label>{item.name}</span>
            </li>
        {/each}
    </ul>
</div>
