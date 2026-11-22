<script lang="ts">
    import { dndzone } from "../../../src/action";
    import type { DndEvent } from "../../../src/types";

    type Row = { id: number; name: string; choice: string };

    let { onCall }: { onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void } = $props();

    let items = $state<Row[]>([
        { id: 1, name: "a", choice: "1" },
        { id: 2, name: "b", choice: "1" },
    ]);
</script>

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
    {#each items as item (item.id)}
        <li>
            {item.name}
            <select data-testid="select-{item.id}" bind:value={item.choice}>
                <option value="1">one</option>
                <option value="2">two</option>
                <option value="3">three</option>
            </select>
        </li>
    {/each}
</ul>
