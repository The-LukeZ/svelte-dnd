<script lang="ts">
    import { dragHandle, dragHandleZone } from "../../../src/wrappers/withDragHandles";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: string; name: string };

    let {
        onCall,
    }: {
        onCall?: (zone: "a" | "b", kind: "consider" | "finalize", detail: DndEvent) => void;
    } = $props();

    let zones = $state({
        a: [
            { id: "a1", name: "a1" },
            { id: "a2", name: "a2" },
        ],
        b: [
            { id: "b1", name: "b1" },
            { id: "b2", name: "b2" },
        ],
    });
    let disabled = $state({ a: false, b: false });
    const names = ["a", "b"] as const;
</script>

{#each names as name (name)}
    <ul
        data-testid="zone-{name}"
        aria-label="zone {name}"
        style="min-height: 60px"
        {@attach dragHandleZone(() => ({
            items: zones[name],
            flipDurationMs: 0,
            dragDisabled: disabled[name],
            onconsider: (detail: DndEvent<Row>) => {
                zones[name] = detail.items;
                onCall?.(name, "consider", detail);
            },
            onfinalize: (detail: DndEvent<Row>) => {
                zones[name] = detail.items;
                onCall?.(name, "finalize", detail);
            },
        }))}
    >
        {#each zones[name] as item (item.id)}
            <li><span data-testid="handle-{name}" {@attach dragHandle}>::</span> {item.name}</li>
        {/each}
    </ul>
    <button onclick={() => (disabled[name] = !disabled[name])}>toggle {name}</button>
{/each}
