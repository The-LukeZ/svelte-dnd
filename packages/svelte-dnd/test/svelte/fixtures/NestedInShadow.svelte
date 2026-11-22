<script lang="ts">
    import { dndzone } from "../../../src/action";
    import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from "../../../src/constants";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: string; name: string; isDndShadowItem?: boolean };

    // hint false leaves the shadow item unmarked, to see what the engine does without the hint
    let {
        hint = true,
        onCall,
        onInnerCall,
    }: {
        hint?: boolean;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
        onInnerCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
    } = $props();

    let outer = $state<Row[]>([
        { id: "o1", name: "o1" },
        { id: "o2", name: "o2" },
        { id: "o3", name: "o3" },
    ]);
    // one shared list is enough: the test counts zones, not their items
    let inner = $state<Row[]>([{ id: "i1", name: "i1" }]);
</script>

<ul
    data-testid="outer"
    {@attach dndzone(() => ({
        items: outer,
        flipDurationMs: 0,
        type: "outer",
        onconsider: (detail: DndEvent<Row>) => {
            outer = detail.items;
            onCall?.("consider", detail);
        },
        onfinalize: (detail: DndEvent<Row>) => {
            outer = detail.items;
            onCall?.("finalize", detail);
        },
    }))}
>
    {#each outer as item (item.id)}
        <li data-is-dnd-shadow-item-hint={hint ? item[SHADOW_ITEM_MARKER_PROPERTY_NAME] : undefined}>
            {item.name}
            <ul
                data-testid="inner"
                {@attach dndzone(() => ({
                    items: inner,
                    flipDurationMs: 0,
                    type: "inner",
                    onconsider: (detail: DndEvent<Row>) => {
                        inner = detail.items;
                        onInnerCall?.("consider", detail);
                    },
                    onfinalize: (detail: DndEvent<Row>) => {
                        inner = detail.items;
                        onInnerCall?.("finalize", detail);
                    },
                }))}
            >
                {#each inner as child (child.id)}
                    <li>{child.name}</li>
                {/each}
            </ul>
        </li>
    {/each}
</ul>
