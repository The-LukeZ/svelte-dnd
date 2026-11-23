<script lang="ts">
    import { tick } from "svelte";
    import { fade } from "svelte/transition";
    import { dndzone } from "../../../src/action";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: number; name: string };

    let {
        initial,
        outMs = 300,
        onlyOnRemove = false,
        onCall,
    }: {
        initial: Row[];
        outMs?: number;
        /** the documented workaround: play the out transition only for items the user removes */
        onlyOnRemove?: boolean;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    let items = $state(initial);
    let removing = $state(false);

    // Svelte reads the transition's parameters when the transition starts, so they can depend on why the item leaves
    function outDuration(): number {
        return !onlyOnRemove || removing ? outMs : 0;
    }

    async function remove(id: number): Promise<void> {
        removing = true;
        items = items.filter((item) => item.id !== id);
        await tick();
        removing = false;
    }
</script>

<!-- an out transition on the items, as in upstream isaacHagoel/svelte-dnd-action#96 -->
<ul
    data-testid="zone"
    {@attach dndzone(() => ({
        items,
        flipDurationMs: 0,
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
    {#each items as item (item.id)}<li out:fade={{ duration: outDuration() }}>{item.name}</li>{/each}
</ul>
<button data-testid="remove-first" onclick={() => remove(items[0].id)}>remove</button>
