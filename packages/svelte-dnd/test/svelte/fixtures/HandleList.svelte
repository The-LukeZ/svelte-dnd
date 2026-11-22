<script lang="ts">
    import { dragHandle, dragHandleZone } from "../../../src/wrappers/withDragHandles";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: number; name: string };

    let {
        initial,
        onCall,
    }: {
        initial: Row[];
        onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    let items = $state(initial);
    let dragDisabled = $state(false);
</script>

<ul
    data-testid="zone"
    {@attach dragHandleZone(() => ({
        items,
        flipDurationMs: 0,
        dragDisabled,
        onconsider: (detail: DndEvent<Row>) => {
            items = detail.items;
            onCall?.("consider", detail);
        },
        onfinalize: (detail: DndEvent<Row>) => {
            items = detail.items;
            onCall?.("finalize", detail);
        },
    }))}
>
    {#each items as item (item.id)}
        <li><span data-testid="handle" {@attach dragHandle}>::</span> {item.name}</li>
    {/each}
</ul>
<button onclick={() => (items = [...items, { id: 4, name: "d" }])}>add</button>
<button onclick={() => (dragDisabled = !dragDisabled)}>toggle</button>
