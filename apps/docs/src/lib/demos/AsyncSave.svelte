<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, SOURCES, TRIGGERS, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };

    const flipDurationMs = 200;

    // A fake server: it answers after a short delay, and fails when asked to.
    function saveOnServer(order: Task[], shouldFail: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (shouldFail) reject(new Error("The server is not reachable."));
                else resolve();
            }, 800);
        });
    }

    const initial: Task[] = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
        { id: 3, name: "Item 3" },
        { id: 4, name: "Item 4" },
    ];
    let items = $state<Task[]>([...initial]);
    // The order the server knows about. A failed save puts the list back to it.
    let saved: Task[] = [...initial];
    let failing = $state(false);
    let saving = $state(false);
    let status = $state("Drag an item to save the new order.");

    // During a pointer drag the list only follows the pointer. A keyboard drag ends with a consider event instead, and
    // every arrow key sends a finalize event, so the keyboard saves when the user drops the item.
    function consider(e: DndEvent<Task>) {
        items = e.items;
        if (e.info.trigger === TRIGGERS.DRAG_STOPPED) void save(e.items);
    }

    function finalize(e: DndEvent<Task>) {
        items = e.items;
        if (e.info.source === SOURCES.POINTER) void save(e.items);
    }

    async function save(order: Task[]) {
        const unchanged = order.every((item, index) => item.id === saved[index].id);
        if (unchanged) return;

        saving = true;
        status = "Saving...";
        try {
            await saveOnServer(order, failing);
            saved = [...order];
            status = "Saved.";
        } catch (error) {
            // Roll back: show the last order the server accepted.
            items = saved;
            status = `Could not save, the list went back. ${error instanceof Error ? error.message : ""}`;
        } finally {
            saving = false;
        }
    }
</script>

<div class="not-prose flex w-full max-w-xs flex-col gap-3">
    <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={failing} />
        Make the server fail
    </label>
    <!-- Dragging is off while a save is running, so a second drop cannot overlap it. -->
    <ul
        aria-label="Saved list"
        aria-busy={saving}
        class="flex flex-col gap-2 {saving ? 'opacity-60' : ''}"
        {@attach dndzone(() => ({
            items,
            flipDurationMs,
            dragDisabled: saving,
            onconsider: consider,
            onfinalize: finalize,
        }))}
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
    <p role="status" class="text-muted-foreground text-sm">{status}</p>
</div>
