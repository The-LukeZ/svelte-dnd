<script lang="ts">
    import { flip } from "svelte/animate";
    import { configure, dndzone, SOURCES, TRIGGERS, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string; selected: boolean; isDndShadowItem?: boolean };

    const flipDurationMs = 200;

    let items = $state<Task[]>(
        ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape"].map((name, index) => ({
            id: index + 1,
            name,
            selected: false,
        })),
    );
    // The selected items that travel with the dragged one. They leave the list while the drag runs.
    let companions = $state<Task[]>([]);
    // The list as it was when the drag started, for a drop outside of the zone.
    let before: Task[] = [];
    let dragging = $state(false);
    // The last item that was selected, where Shift-click and Shift+Space start their range.
    let anchorId: number | null = null;
    const selectedCount = $derived(items.filter((item) => item.selected).length + companions.length);

    // Enter picks an item up, so that Space is free to select it.
    $effect(() => {
        configure({ keyboardDragTrigger: "enter" });
        return () => configure({ keyboardDragTrigger: null });
    });

    function select(item: Task, range: boolean) {
        if (range && anchorId !== null) {
            const from = items.findIndex((task) => task.id === anchorId);
            const to = items.indexOf(item);
            const [start, end] = from < to ? [from, to] : [to, from];
            items.forEach((task, index) => (task.selected = index >= start && index <= end));
        } else {
            item.selected = !item.selected;
            anchorId = item.id;
        }
    }

    function onkeydown(e: KeyboardEvent, item: Task) {
        if (e.key !== " " || dragging) return;
        e.preventDefault();
        select(item, e.shiftKey);
    }

    function consider(e: DndEvent<Task>) {
        if (e.info.trigger === TRIGGERS.DRAG_STARTED) {
            before = [...items];
            dragging = true;
            const dragged = items.find((item) => item.id === e.info.id)!;
            // Picking up an item that is not selected drags that one item alone.
            if (!dragged.selected) items.forEach((item) => (item.selected = false));
            dragged.selected = true;
            companions = items.filter((item) => item.selected && item !== dragged);
            // Take the others out of the list. They come back next to the dragged item when it drops.
            items = e.items.filter((item) => !companions.some((other) => other.id === item.id));
        } else if (e.info.trigger === TRIGGERS.DRAG_STOPPED) {
            // A keyboard drag ends with this consider event.
            drop(e.items, e.info.id, false);
        } else {
            items = e.items;
        }
    }

    function finalize(e: DndEvent<Task>) {
        // Every arrow key of a keyboard drag sends a finalize event. The drag is not over yet.
        if (e.info.source === SOURCES.KEYBOARD) {
            items = e.items;
            return;
        }
        drop(e.items, e.info.id, e.info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY);
    }

    function drop(dropped: Task[], id: number, outside: boolean) {
        let next = before;
        if (!outside) {
            const at = dropped.findIndex((item) => item.id === id);
            next = [...dropped.slice(0, at + 1), ...companions, ...dropped.slice(at + 1)];
        }
        next.forEach((item) => (item.selected = false));
        items = next;
        companions = [];
        dragging = false;
        anchorId = null;
    }

    // A pointer drag shows a clone of the item. Say how many items it carries.
    function transformDraggedElement(el?: HTMLElement) {
        if (el && companions.length > 0) el.dataset.carrying = `+${companions.length}`;
    }
</script>

<div class="not-prose flex w-full max-w-xs flex-col gap-3">
    <p class="text-muted-foreground text-sm">
        Click to select, Shift-click for a range, then drag. With the keyboard, press Space to select, Shift+Space for a
        range, and Enter to pick up.
    </p>
    <ul
        aria-label="Fruit"
        class="flex flex-col gap-2"
        {@attach dndzone(() => ({
            items,
            flipDurationMs,
            transformDraggedElement,
            onconsider: consider,
            onfinalize: finalize,
        }))}
    >
        {#each items as item (item.id)}
            <!-- The library makes the items focusable, so the keys are for them. -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li
                class="bg-card text-card-foreground flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm select-none data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 after:text-xs after:font-medium after:content-[attr(data-carrying)]"
                data-selected={item.selected}
                animate:flip={{ duration: flipDurationMs }}
                onclick={(e) => select(item, e.shiftKey)}
                onkeydown={(e) => onkeydown(e, item)}
            >
                {item.name}
            </li>
        {/each}
    </ul>
    <p role="status" class="text-muted-foreground text-sm">
        {selectedCount === 0 ? "Nothing selected." : `${selectedCount} selected.`}
    </p>
</div>
