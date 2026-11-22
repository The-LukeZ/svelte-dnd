---
title: Board
description: "Columns of cards: nested zones, scrolling containers and a scrolling page."
section: Demos
order: 3
---

<script>
    import { LiveExample } from "svelte-docsmith";
    import Board from "#lib/demos/Board.svelte";
    import boardSource from "#lib/demos/Board.svelte?source";
</script>

<LiveExample source={boardSource}>
    <Board />
</LiveExample>

The board is a zone of columns, and each column is a zone of cards. The two levels have different types, `"column"` and `"card"`, so a card cannot land between columns and a column cannot land inside a column. The second column scrolls when its cards do not fit, the board scrolls sideways, and the page scrolls when you drag near its edge. Each column carries `data-is-dnd-shadow-item-hint`, which stops the library from setting up the card zone inside the column's placeholder. See [how it works](/docs/how-it-works) for the shadow item and the [options](/docs/api/options) for `type`.
