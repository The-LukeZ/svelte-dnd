<script lang="ts">
    import { dragHandle, dragHandleZone } from "../../../src/wrappers/withDragHandles";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: string; name: string };

    let outer = $state<Row[]>([
        { id: "o1", name: "o1" },
        { id: "o2", name: "o2" },
    ]);
    let inner = $state<Row[]>([
        { id: "i1", name: "i1" },
        { id: "i2", name: "i2" },
    ]);
    let outerDisabled = $state(false);
    let innerDisabled = $state(false);
</script>

<ul
    data-testid="outer"
    {@attach dragHandleZone(() => ({
        items: outer,
        flipDurationMs: 0,
        type: "outer",
        dragDisabled: outerDisabled,
        onconsider: (detail: DndEvent<Row>) => (outer = detail.items),
        onfinalize: (detail: DndEvent<Row>) => (outer = detail.items),
    }))}
>
    {#each outer as item (item.id)}
        <li>
            <span data-testid="outer-handle" {@attach dragHandle}>::</span>
            {item.name}
            {#if item.id === "o1"}
                <ul
                    data-testid="inner"
                    {@attach dragHandleZone(() => ({
                        items: inner,
                        flipDurationMs: 0,
                        type: "inner",
                        dragDisabled: innerDisabled,
                        onconsider: (detail: DndEvent<Row>) => (inner = detail.items),
                        onfinalize: (detail: DndEvent<Row>) => (inner = detail.items),
                    }))}
                >
                    {#each inner as child (child.id)}
                        <li><span data-testid="inner-handle" {@attach dragHandle}>::</span> {child.name}</li>
                    {/each}
                </ul>
            {/if}
        </li>
    {/each}
</ul>
<button onclick={() => (outerDisabled = !outerDisabled)}>toggle outer</button>
<button onclick={() => (innerDisabled = !innerDisabled)}>toggle inner</button>
