---
title: Nested zones
description: "Zones inside the items of other zones, like the columns and cards of a board, and the shadow hint that keeps them fast."
section: Guides
order: 11
---

A zone can sit inside an item of another zone. A board is the usual case: the board is a zone of columns, and each column holds a zone of cards. The [board demo](/docs/demos/board) is one.

```svelte
<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Card = { id: number; name: string };
    type Column = { id: number; name: string; cards: Card[]; isDndShadowItem?: boolean };

    const flipDurationMs = 200;
    let columns = $state<Column[]>([]);

    function updateColumns(e: DndEvent<Column>) {
        columns = e.items;
    }

    function updateCards(column: Column, e: DndEvent<Card>) {
        column.cards = e.items;
    }
</script>

<div
    {@attach dndzone(() => ({
        items: columns,
        type: "column",
        flipDurationMs,
        onconsider: updateColumns,
        onfinalize: updateColumns,
    }))}
>
    {#each columns as column (column.id)}
        <section data-is-dnd-shadow-item-hint={column.isDndShadowItem} animate:flip={{ duration: flipDurationMs }}>
            <h3>{column.name}</h3>
            <div
                {@attach dndzone(() => ({
                    items: column.cards,
                    type: "card",
                    flipDurationMs,
                    onconsider: (e) => updateCards(column, e),
                    onfinalize: (e) => updateCards(column, e),
                }))}
            >
                {#each column.cards as card (card.id)}
                    <div animate:flip={{ duration: flipDurationMs }}>{card.name}</div>
                {/each}
            </div>
        </section>
    {/each}
</div>
```

## Separate the levels with types

Without a `type`, every zone shares one, so a card could be dropped between the columns and a column inside another column. Give each level its own type, here `"column"` and `"card"`. Items in zones of one type are expected to have the same shape, see [zone types](/docs/how-it-works#zone-types).

## Update the nested list in place

The inner zone's handlers write to the column they belong to: `column.cards = e.items`. Because `columns` is a `$state` array, `column` is a deeply reactive proxy, and the assignment updates the board. A drag of a card from one column to another calls `onfinalize` on both inner zones, and each writes its own column.

## The shadow hint

While a column is dragged, the board's `items` contain the [shadow item](/docs/how-it-works#the-shadow-item): a copy of the dragged column, cards included, that renders the placeholder. Its card zone would be set up for the length of the drag, with the same card ids as the column being dragged. That is wasted work, and with deeper nesting it adds up.

Mark the item element with the hint attribute, so the library skips the zones inside the placeholder:

```svelte
<section data-is-dnd-shadow-item-hint={column.isDndShadowItem}>
```

`isDndShadowItem` is the marker property the library sets on the shadow item. Its name is exported as `SHADOW_ITEM_MARKER_PROPERTY_NAME`, so `column[SHADOW_ITEM_MARKER_PROPERTY_NAME]` works the same. Add the property to your item type as optional, as `Column` does above.

A zone inside a hinted element waits: it gets no zone while the hint is `true`, and its real zone once the hint goes away. After a drop, the placeholder's element stays as the dropped column's element, so its card zone comes to life then. The key of the `#each` block can stay the item's id. Unlike `svelte-dnd-action`, the hint does not have to be part of the key.

## Filtering the shadow item

The shadow item is in your `items` during a pointer drag, so code that counts or filters items sees it. When you pass a column's items to a component that does not expect it, filter it out by its marker:

```ts
import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from "@lukez/svelte-dnd";

const realCards = column.cards.filter((card) => !(SHADOW_ITEM_MARKER_PROPERTY_NAME in card));
```

Its id is `SHADOW_PLACEHOLDER_ITEM_ID`, a string, so with string ids a comparison of ids works too.
