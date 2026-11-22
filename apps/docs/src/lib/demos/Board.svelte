<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Card = { id: number; name: string };
    type Column = { id: number; name: string; cards: Card[]; isDndShadowItem?: boolean };

    const flipDurationMs = 200;

    let nextCardId = 1;
    const makeCards = (count: number): Card[] =>
        Array.from({ length: count }, () => ({ id: nextCardId, name: `Card ${nextCardId++}` }));

    let columns = $state<Column[]>([
        { id: 1, name: "To do", cards: makeCards(3) },
        { id: 2, name: "In progress", cards: makeCards(8) },
        { id: 3, name: "Review", cards: makeCards(2) },
        { id: 4, name: "Done", cards: makeCards(1) },
        { id: 5, name: "Archive", cards: makeCards(0) },
    ]);

    function updateColumns(e: DndEvent<Column>) {
        columns = e.items;
    }

    function updateCards(column: Column, e: DndEvent<Card>) {
        column.cards = e.items;
    }
</script>

<div class="not-prose w-full min-w-0">
    <!-- The board is a zone of columns. Its type keeps a card from being dropped between the columns. -->
    <div
        aria-label="Board"
        class="flex items-start gap-3 overflow-x-auto p-2"
        {@attach dndzone(() => ({
            items: columns,
            type: "column",
            flipDurationMs,
            onconsider: updateColumns,
            onfinalize: updateColumns,
        }))}
    >
        {#each columns as column (column.id)}
            <!-- The hint keeps the library from setting up the zone inside the placeholder of a dragged column. -->
            <section
                aria-label={column.name}
                class="bg-muted w-48 shrink-0 rounded-md border p-2"
                data-is-dnd-shadow-item-hint={column.isDndShadowItem}
                animate:flip={{ duration: flipDurationMs }}
            >
                <h3 class="mb-2 text-sm font-medium">{column.name}</h3>
                <!-- Each column is a zone of cards, and scrolls when it has many. -->
                <div
                    aria-label="{column.name} cards"
                    class="flex max-h-64 min-h-12 flex-col gap-2 overflow-y-auto"
                    {@attach dndzone(() => ({
                        items: column.cards,
                        type: "card",
                        flipDurationMs,
                        onconsider: (e) => updateCards(column, e),
                        onfinalize: (e) => updateCards(column, e),
                    }))}
                >
                    {#each column.cards as card (card.id)}
                        <div
                            class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                            animate:flip={{ duration: flipDurationMs }}
                        >
                            {card.name}
                        </div>
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</div>
