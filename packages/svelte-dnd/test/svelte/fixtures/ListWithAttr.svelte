<script lang="ts">
    import { dndzone } from "../../../src/action";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: number; name: string };

    let {
        initial,
        spy,
        onCall,
    }: {
        initial: Row[];
        // called if the zone element ever gets a consider or finalize DOM event
        spy: (e: Event) => void;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent) => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    let items = $state(initial);
    // Svelte 5 adds an on* attribute as a listener for that event name. Spread, because the element types know no
    // consider or finalize event, which is the point: nothing should dispatch them.
    const listeners = $derived({ onconsider: spy, onfinalize: spy });
</script>

<ul
    data-testid="zone"
    {...listeners}
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
    {#each items as item (item.id)}<li>{item.name}</li>{/each}
</ul>
