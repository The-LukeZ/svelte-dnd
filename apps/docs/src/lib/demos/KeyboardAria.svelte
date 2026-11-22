<script lang="ts">
    import { flip } from "svelte/animate";
    import { configure, dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };
    type Trigger = "space" | "enter" | "space_or_enter";

    const flipDurationMs = 200;

    let todo = $state<Task[]>([
        { id: 1, name: "Water the plants" },
        { id: 2, name: "Buy milk" },
        { id: 3, name: "Call the bank" },
    ]);
    let done = $state<Task[]>([{ id: 4, name: "Book the flights" }]);
    const locked: Task[] = [{ id: 5, name: "Pay the rent" }];
    // Shown on the page so you can read what a screen reader announces.
    let announcement = $state("Nothing announced yet.");
    let trigger = $state<Trigger>("space_or_enter");

    // The settings are global, so set them when the demo mounts and restore them when it goes away.
    $effect(() => {
        const say = (text: string) => {
            announcement = text;
            return text;
        };
        configure({
            ariaStrings: {
                dragStarted: ({ itemLabel, zoneLabel, position, count }) =>
                    say(`Picked up ${itemLabel}, number ${position} of ${count} in ${zoneLabel}.`),
                movedToPosition: ({ itemLabel, position, count }) =>
                    say(`${itemLabel} is now number ${position} of ${count}.`),
                movedToZoneEnd: ({ itemLabel, zoneLabel }) => say(`${itemLabel} is now last in ${zoneLabel}.`),
                movedToZoneStart: ({ itemLabel, zoneLabel }) => say(`${itemLabel} is now first in ${zoneLabel}.`),
                dropped: ({ itemLabel, zoneLabel, position, count }) =>
                    say(`Dropped ${itemLabel} as number ${position} of ${count} in ${zoneLabel}.`),
                zoneActiveInstruction: ({ keyboardDragTrigger }) =>
                    `Focus a task and press ${keyboardDragTrigger === "enter" ? "Enter" : keyboardDragTrigger === "space" ? "Space" : "Space or Enter"} to pick it up.`,
                zoneDragDisabledInstruction: "This list is locked.",
            },
        });
        return () => configure({ ariaStrings: null });
    });

    $effect(() => {
        configure({ keyboardDragTrigger: trigger });
        return () => configure({ keyboardDragTrigger: null });
    });

    function updateTodo(e: DndEvent<Task>) {
        todo = e.items;
    }

    function updateDone(e: DndEvent<Task>) {
        done = e.items;
    }
</script>

<div class="not-prose flex w-full max-w-xl flex-col gap-4">
    <label class="flex items-center gap-2 text-sm">
        Drag keys
        <select bind:value={trigger} class="bg-background rounded-md border px-2 py-1">
            <option value="space_or_enter">Space or Enter</option>
            <option value="space">Space</option>
            <option value="enter">Enter</option>
        </select>
    </label>

    <div class="grid gap-4 sm:grid-cols-3">
        <div>
            <h3 class="mb-1 text-sm font-medium">To do</h3>
            <!-- The labels of the zone and of the items are what the announcements call them. -->
            <ul
                aria-label="To do"
                class="flex min-h-24 flex-col gap-2 rounded-md border border-dashed p-2"
                {@attach dndzone(() => ({
                    items: todo,
                    flipDurationMs,
                    onconsider: updateTodo,
                    onfinalize: updateTodo,
                }))}
            >
                {#each todo as task (task.id)}
                    <li
                        aria-label={task.name}
                        class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                        animate:flip={{ duration: flipDurationMs }}
                    >
                        {task.name}
                    </li>
                {/each}
            </ul>
        </div>
        <div>
            <h3 class="mb-1 text-sm font-medium">Done</h3>
            <ul
                aria-label="Done"
                class="flex min-h-24 flex-col gap-2 rounded-md border border-dashed p-2"
                {@attach dndzone(() => ({
                    items: done,
                    flipDurationMs,
                    onconsider: updateDone,
                    onfinalize: updateDone,
                }))}
            >
                {#each done as task (task.id)}
                    <li
                        aria-label={task.name}
                        class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                        animate:flip={{ duration: flipDurationMs }}
                    >
                        {task.name}
                    </li>
                {/each}
            </ul>
        </div>
        <div>
            <h3 class="mb-1 text-sm font-medium">Locked</h3>
            <!-- A zone with dragDisabled gets its own instruction, and its items do not take part in keyboard drags. -->
            <ul
                aria-label="Locked"
                class="flex min-h-24 flex-col gap-2 rounded-md border border-dashed p-2 opacity-70"
                {@attach dndzone(() => ({ items: locked, dragDisabled: true }))}
            >
                {#each locked as task (task.id)}
                    <li aria-label={task.name} class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm">
                        {task.name}
                    </li>
                {/each}
            </ul>
        </div>
    </div>

    <p class="text-muted-foreground text-sm">Last announcement: <span class="text-foreground">{announcement}</span></p>
</div>
