<script lang="ts">
    import { flip } from "svelte/animate";
    import { dragHandle, dragHandleZone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string };
    type Group = { id: number; name: string; tasks: Task[]; isDndShadowItem?: boolean };

    const flipDurationMs = 200;

    let groups = $state<Group[]>([
        {
            id: 1,
            name: "Design",
            tasks: [
                { id: 1, name: "Sketch the layout" },
                { id: 2, name: "Pick the colors" },
            ],
        },
        {
            id: 2,
            name: "Build",
            tasks: [
                { id: 3, name: "Write the markup" },
                { id: 4, name: "Add the styles" },
                { id: 5, name: "Wire up the data" },
            ],
        },
    ]);

    function updateGroups(e: DndEvent<Group>) {
        groups = e.items;
    }

    function updateTasks(group: Group, e: DndEvent<Task>) {
        group.tasks = e.items;
    }
</script>

{#snippet grip()}
    <svg aria-hidden="true" viewBox="0 0 8 14" class="h-4 w-3 fill-current">
        <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
        <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
        <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
    </svg>
{/snippet}

<!-- Only the grips start a drag. The text in the items stays selectable. -->
<div class="not-prose w-full max-w-md">
    <ul
        aria-label="Groups"
        class="flex flex-col gap-3"
        {@attach dragHandleZone(() => ({
            items: groups,
            type: "group",
            flipDurationMs,
            onconsider: updateGroups,
            onfinalize: updateGroups,
        }))}
    >
        {#each groups as group (group.id)}
            <li
                class="bg-muted rounded-md border p-2"
                data-is-dnd-shadow-item-hint={group.isDndShadowItem}
                animate:flip={{ duration: flipDurationMs }}
            >
                <div class="mb-2 flex items-center gap-2 text-sm font-medium">
                    <span aria-label="Drag group {group.name}" class="text-muted-foreground" {@attach dragHandle}>
                        {@render grip()}
                    </span>
                    {group.name}
                </div>
                <!-- A handle zone inside another one works the same way. Each grip belongs to the zone around it. -->
                <ul
                    aria-label="{group.name} tasks"
                    class="flex min-h-10 flex-col gap-2"
                    {@attach dragHandleZone(() => ({
                        items: group.tasks,
                        type: "task",
                        flipDurationMs,
                        onconsider: (e) => updateTasks(group, e),
                        onfinalize: (e) => updateTasks(group, e),
                    }))}
                >
                    {#each group.tasks as task (task.id)}
                        <li
                            class="bg-card text-card-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            animate:flip={{ duration: flipDurationMs }}
                        >
                            <span aria-label="Drag {task.name}" class="text-muted-foreground" {@attach dragHandle}>
                                {@render grip()}
                            </span>
                            {task.name}
                        </li>
                    {/each}
                </ul>
            </li>
        {/each}
    </ul>
</div>
