<script lang="ts">
    import { dndzone } from "../../../src/action";
    import { dragHandle, dragHandleZone } from "../../../src/wrappers/withDragHandles";
    import type { DndEvent, Options } from "../../../src/types";

    type Row = { id: number; name: string };

    let {
        initial,
        handles = false,
        onCall,
    }: {
        initial: Row[];
        handles?: boolean;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
    } = $props();

    // one $state object that is never reassigned: the callbacks and the buttons write its properties
    // svelte-ignore state_referenced_locally
    let options: Options<Row> = $state({
        items: initial,
        flipDurationMs: 0,
        onconsider: (detail: DndEvent<Row>) => {
            options.items = detail.items;
            onCall?.("consider", detail);
        },
        onfinalize: (detail: DndEvent<Row>) => {
            options.items = detail.items;
            onCall?.("finalize", detail);
        },
    });
</script>

<ul data-testid="zone" {@attach handles ? dragHandleZone(() => options) : dndzone(() => options)}>
    {#each options.items as item (item.id)}
        <li>
            {#if handles}<span data-testid="handle" {@attach dragHandle}>::</span>{/if}{item.name}
        </li>
    {/each}
</ul>
<button onclick={() => (options.items = [...options.items, { id: 4, name: "d" }])}>add</button>
<button onclick={() => (options.dragDisabled = !options.dragDisabled)}>lock</button>
