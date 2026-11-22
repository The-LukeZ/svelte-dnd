<script lang="ts">
    import { dndzone } from "../../../src/action";
    import type { DndEvent, Options } from "../../../src/types";

    type Row = { id: number; name: string };

    let {
        initial,
        extra = {},
        onCall,
    }: {
        initial: Row[];
        extra?: Partial<Options<Row>>;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent, run: number) => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    let items = $state(initial);
    // not state: the getter writes it, and reading it must not make the getter depend on it
    let runs = 0;

    function getOptions(): Options<Row> {
        // each run builds new closures that remember the run they came from
        const run = runs++;
        return {
            items,
            flipDurationMs: 0,
            ...extra,
            onconsider: (detail) => {
                items = detail.items;
                onCall?.("consider", detail, run);
            },
            onfinalize: (detail) => {
                items = detail.items;
                onCall?.("finalize", detail, run);
            },
        };
    }
</script>

<ul data-testid="zone" {@attach dndzone(getOptions)}>
    {#each items as item (item.id)}<li>{item.name}</li>{/each}
</ul>
<button onclick={() => (items = [...items, { id: 4, name: "d" }])}>add</button>
