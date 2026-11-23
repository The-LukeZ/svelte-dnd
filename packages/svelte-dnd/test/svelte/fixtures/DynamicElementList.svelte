<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone } from "../../../src/action";
    import { dragHandle, dragHandleZone } from "../../../src/wrappers/withDragHandles";
    import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from "../../../src/constants";
    import type { DndEvent, Options } from "../../../src/types";

    type Row = { id: number; name: string; [SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean };

    let {
        initial,
        tag = "ul",
        flipDurationMs = 0,
        handles = false,
        onCall,
    }: {
        initial: Row[];
        tag?: string;
        flipDurationMs?: number;
        handles?: boolean;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    let items = $state(initial);

    function getOptions(): Options<Row> {
        return {
            items,
            flipDurationMs,
            onconsider: (detail) => {
                items = detail.items;
                onCall?.("consider", detail);
            },
            onfinalize: (detail) => {
                items = detail.items;
                onCall?.("finalize", detail);
            },
        };
    }

    // svelte-ignore state_referenced_locally
    const zone = handles ? dragHandleZone(getOptions) : dndzone(getOptions);
</script>

<!-- the zone is a <svelte:element>, as in upstream isaacHagoel/svelte-dnd-action#640 -->
<svelte:element this={tag} data-testid="zone" {@attach zone}>
    <!-- the key changes for the shadow item, so Svelte renders a new element for it -->
    {#each items as item (`${item.id}${item[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? "_shadow" : ""}`)}
        <li animate:flip={{ duration: flipDurationMs }}>
            {#if handles}<span data-testid="handle" {@attach dragHandle}>::</span>{/if}{item.name}
        </li>
    {/each}
</svelte:element>
