---
title: How it works
description: The consider and finalize lifecycle, the shadow item, zone types, item ids and the rules a zone relies on.
order: 2
---

## You own the items

A zone does not hold state. You give it `items`, the list you render in your `#each` block, and the library reads the DOM and the pointer to work out what the list should become. It does not assign to your list. It calls `onconsider` and `onfinalize` with the proposed list, and you decide what to do with it. In most apps that is `items = e.items`.

Because of that, the library works with any state you have: a `$state` array, a prop, a store, or a list you copy and send to a server before you accept it.

## Consider and finalize

Every event has the same shape: `e.items` is the list the zone should render, and `e.info` describes what happened.

- `onconsider` is for a drag in progress. It fires as the dragged item enters a zone, moves over another index, or leaves. Render the list you receive so the other items make room.
- `onfinalize` is for a result. It fires when the item is dropped, in the zone the item was dropped into and in the zone it came from, if that is another one. A pointer drag sends it once, when the drag ends. A keyboard drag drops the item on every arrow key, so it sends `onfinalize` on every move, and ends with an `onconsider` with the `DRAG_STOPPED` trigger. To save to a server once per drag, see [saving after a drag](/docs/guides/keyboard-and-screen-readers#saving-after-a-drag).

`e.info` has three fields: `trigger`, the kind of event, `id`, the id of the dragged item, and `source`, which is `"pointer"` or `"keyboard"`. Most apps ignore it. Copy on drag and similar behaviors use it.

The triggers are the values of the exported `TRIGGERS` object. Triggers marked pointer only never happen in a keyboard drag.

| Event        | Trigger (`TRIGGERS.…`)    | Sent to, and when                                                                             |
| ------------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| `onconsider` | `DRAG_STARTED`            | The zone the drag started from.                                                               |
| `onconsider` | `DRAGGED_ENTERED`         | A zone the item entered. Pointer only.                                                        |
| `onconsider` | `DRAGGED_ENTERED_ANOTHER` | The zone the drag started from, when the item enters another zone. Pointer only.              |
| `onconsider` | `DRAGGED_OVER_INDEX`      | A zone, when the item moves over another index of it. Pointer only.                           |
| `onconsider` | `DRAGGED_LEFT`            | A zone the item left. Pointer only.                                                           |
| `onconsider` | `DRAGGED_LEFT_ALL`        | The zone the drag started from, when the item is outside of every zone. Pointer only.         |
| `onconsider` | `DRAG_STOPPED`            | The zone, when the user ends a keyboard drag. Keyboard only.                                  |
| `onfinalize` | `DROPPED_INTO_ZONE`       | The zone the item was dropped into. A keyboard drag sends it each time an arrow key moves it. |
| `onfinalize` | `DROPPED_INTO_ANOTHER`    | The zone the item came from, when it is dropped into another zone.                            |
| `onfinalize` | `DROPPED_OUTSIDE_OF_ANY`  | The zone the item came from, when it is dropped outside of every zone. Pointer only.          |

A drag within one zone sends `onfinalize` to that zone only. A drag from one zone to another sends it to both, so both lists must be updated. That is another reason to keep the handlers simple: assign what you get.

## The shadow item

During a pointer drag, the zone the item hovers over receives a temporary item in its `items`: the shadow item. It is a copy of the dragged item's data with two changes:

- its id is `SHADOW_PLACEHOLDER_ITEM_ID`, instead of the item's own id.
- it has the property `isDndShadowItem` set to `true`. The name is exported as `SHADOW_ITEM_MARKER_PROPERTY_NAME`.

It is what makes the other items move aside, and it marks where the item would land. While it is in the list, the element it renders is the placeholder under the dragged element, which follows the pointer. When the drag ends, the shadow item is replaced by the dragged item with its real id.

Check the marker in your `#each` block to style the placeholder:

```svelte
<script lang="ts">
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: number; name: string; isDndShadowItem?: boolean };

    let items = $state<Task[]>([]);

    function update(e: DndEvent<Task>) {
        items = e.items;
    }
</script>

<ul {@attach dndzone(() => ({ items, onconsider: update, onfinalize: update }))}>
    {#each items as item (item.id)}
        <li class:placeholder={item.isDndShadowItem}>{item.name}</li>
    {/each}
</ul>
```

Two more things to know about it:

- Your rendering code sees it, so a nested zone that filters or counts items must expect it. Filter on `SHADOW_PLACEHOLDER_ITEM_ID` when you pass `items` down to a nested zone.
- With nested zones, mark the item with `data-is-dnd-shadow-item-hint={item.isDndShadowItem}` so the library does not set up zones inside the placeholder. See [nested zones](/docs/guides/nested-zones#the-shadow-hint).

Keyboard drags do not add a shadow item. The item moves in the list directly.

## Zone types

By default every zone has the same type, so an item can move between any two zones. Give zones a `type` to limit that: an item can only be dropped in a zone of its own type.

```svelte
<ul {@attach dndzone(() => ({ items: todo, type: "task", onconsider: updateTodo, onfinalize: updateTodo }))}>
```

Items in zones of the same type are expected to have the same shape, because an item can be added to any of them without conversion. `dropFromOthersDisabled` stops a zone from taking items from other zones, and `dragDisabled` stops its items from being dragged, without changing types. Both are in the [options](/docs/api/options).

## Item ids and `configure`

Every item needs a unique id, and the `#each` block uses it as its key. The id is the `id` property by default. If your data uses another name, such as `_id` for PouchDB, change it once, globally, with `configure`:

```svelte
<script lang="ts">
    import { configure } from "@lukez/svelte-dnd";

    configure({ idKey: "_id" });
</script>
```

It applies to every zone, and it throws when a zone is mounted, so call it before any zone renders: at the top of your root layout's `<script>` or at the start of your app. `configure` only sets module state, so it is safe during server-side rendering.

`configure` takes `idKey`, `keyboardDragTrigger`, `ariaStrings` and `debug`. Keys you leave out are not touched.

## Flip animation

Items move aside as a dragged item passes over them, and `animate:flip` from Svelte animates the move. Pass the same duration to the zone as `flipDurationMs`, so the drag and the animation do not conflict. The option also sets the duration of the drop animation.

```svelte
<section {@attach dndzone(() => ({ items, flipDurationMs: 200, onconsider: update, onfinalize: update }))}>
    {#each items as item (item.id)}
        <div animate:flip={{ duration: 200 }}>{item.name}</div>
    {/each}
</section>
```

Without an animation, leave `flipDurationMs` at `0`.

## Rules and assumptions

A zone relies on the following. Break one, and drags behave in ways that are hard to trace.

- Only one element can be dragged at any given time.
- The data of items in zones **of the same type** has the same shape, so an item from one zone can be added to another without conversion.
- Every draggable item has an id under the id key, `id` unless you change it with `configure`. Ids are unique across all zones of the same type.
- The ids are the keys of the `#each` block. Keyless blocks do not work.
- To copy an item, give the copy a new id when you create it.
- The items you pass in are in the same order as the children of the container, which has no extra children and none fewer. In other words, render all of `items` in an `#each` block, and nothing else inside the zone.
- Any data that should survive a drag and a drop belongs in the `items` array.
- Update `items` in both `onconsider` and `onfinalize`. Do not leave out a handler.
- The library adds a temporary item to the items of any zone while an element is dragged around. It must be fine to render it.
- Svelte's built-in transitions (`in:`, `out:`, `transition:`) might not play nice with a zone. Use `animate:flip`, and test any transition you add.
