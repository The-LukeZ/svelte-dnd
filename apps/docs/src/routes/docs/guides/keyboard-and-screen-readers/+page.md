---
title: Keyboard and screen readers
description: "Keyboard drags, aria labels, the drag trigger key, translated screen reader messages and the events of a keyboard drag."
section: Guides
order: 12
---

Every zone works with the keyboard and talks to screen readers without setup. This page shows how to give the messages good names, change the keys, translate the messages, and handle the events a keyboard drag sends. The [keyboard and custom aria demo](/demos/keyboard-aria) shows all of it.

## Label zones and items

Put an `aria-label` on every zone and on every item. The screen reader messages use them to say which item moves and in which list:

```svelte
<h2>{listName}</h2>
<section
    aria-label={listName}
    {@attach dndzone(() => ({ items, flipDurationMs, onconsider: update, onfinalize: update }))}
>
    {#each items as item (item.id)}
        <div aria-label={item.name} animate:flip={{ duration: flipDurationMs }}>{item.name}</div>
    {/each}
</section>
```

Without the labels everything still works, but the messages are less helpful. In a [drag handle](/docs/guides/drag-handles) zone, label the handles too.

The library sets `role="list"` on the zone, `role="listitem"` on its items, and an `aria-describedby` instruction on the zone that tells the user how to start a drag. Semantic markup such as `<ul>` and `<li>` is still a good idea.

## Keyboard support

- Tab to a zone to hear its instructions.
- Tab to an item and press Space or Enter to pick it up. The screen reader says the drag has started.
- Move the item with the arrow keys. Down and Right move it forward, Up and Left move it back. The screen reader says the new position.
- Press Tab to move to another zone that can take the item. The item moves into that zone when the zone gets the focus, and the screen reader says so.
- Press the drag key again on the item, or Escape anywhere, to drop it. The screen reader says the drag has stopped.
- Click another item during a keyboard drag to drag that one instead. Click outside of every item to end the drag.
- Mouse and touch drags work independently of keyboard drags: an item can be dragged with the pointer during a keyboard drag, too.

## Choosing the keyboard drag trigger

By default both Space and Enter start and stop a keyboard drag. If your app needs one of those keys for something else, for example Enter to open the focused item, narrow the trigger:

```ts
import { configure } from "@lukez/svelte-dnd";

configure({ keyboardDragTrigger: "space" });
```

The values are `"space"`, `"enter"` and `"space_or_enter"`, the default. `null` restores the default, and any other value throws. Keys outside the trigger are never claimed, and Escape ends a drag under every trigger.

The setting is global and applies to every zone, so different zones cannot use different keys at the same time. It can change at any time, also after zones have rendered, and the built-in instruction follows it.

## Turning off keyboard dragging

If your app handles the keys of a zone itself, for example with its own keyboard navigation or editable content in the items, set `keyboardDragDisabled` on that zone. Pointer dragging keeps working:

```svelte
<ul {@attach dndzone(() => ({ items, keyboardDragDisabled: true, onconsider, onfinalize }))}>
```

The zone then leaves Space, Enter, the arrow keys and clicks on its items to your app, and a keyboard drag from another zone cannot tab into it. Its screen reader instruction becomes the one of a zone with `dragDisabled`. In a `dragHandleZone`, the handles leave the tab order and ignore the trigger keys.

This makes reordering unavailable to keyboard and screen reader users. Only set it when your app gives them another way to move the items, for example "move up" and "move down" buttons.

## Translating the screen reader messages

To change the wording, for example to translate it, pass `ariaStrings` to `configure`:

```ts
import { configure } from "@lukez/svelte-dnd";

const instructionsParTouche = {
    space: `Tabulez jusqu'à un élément et appuyez sur espace pour le déplacer`,
    enter: `Tabulez jusqu'à un élément et appuyez sur entrée pour le déplacer`,
    space_or_enter: `Tabulez jusqu'à un élément et appuyez sur espace ou entrée pour le déplacer`,
};

configure({
    ariaStrings: {
        dragStarted: ({ itemLabel, zoneLabel, canMoveBetweenZones }) =>
            `Déplacement de ${itemLabel} commencé. Utilisez les flèches pour le déplacer dans la liste ${zoneLabel}` +
            (canMoveBetweenZones ? `, ou tabulez vers une autre liste` : ``),
        movedToPosition: ({ itemLabel, zoneLabel, position }) =>
            `${itemLabel} déplacé en position ${position} dans la liste ${zoneLabel}`,
        movedToZoneEnd: ({ itemLabel, zoneLabel }) => `${itemLabel} déplacé à la fin de la liste ${zoneLabel}`,
        movedToZoneStart: ({ itemLabel, zoneLabel }) => `${itemLabel} déplacé au début de la liste ${zoneLabel}`,
        // The English message leaves out the destination, but yours can name it
        dropped: ({ itemLabel, zoneLabel, position, count }) =>
            `${itemLabel} déposé dans ${zoneLabel}, ${position} sur ${count}`,
        zoneActiveInstruction: ({ keyboardDragTrigger }) => instructionsParTouche[keyboardDragTrigger],
        zoneDragDisabledInstruction: `Cette liste de glisser-déposer est désactivée`,
    },
});
```

Every key is optional, and a key you leave out uses its English default. The five messages are functions, so a translation controls word order and plurals. Each receives `itemLabel` and `zoneLabel`, the `aria-label` attributes of the item and the zone (or empty strings), `position`, the item's position counted from 1, and `count`, the number of items in the zone. `dragStarted` also receives `canMoveBetweenZones`. `zoneActiveInstruction` is a string or a function of the active `keyboardDragTrigger`, so it can name the right key. `zoneDragDisabledInstruction` is a string.

Call it when your app starts, and again when the locale changes. Each call sets a whole locale over the English defaults, so keys you leave out go back to English instead of keeping the previous locale's text. The instructions already on the page update at once. `null` restores English, and unknown keys or values of the wrong type throw. Like the trigger, the strings are global: different zones cannot use different strings at the same time. A function that throws falls back to the English message.

All keys are listed in the [`AriaStrings` reference](/docs/api/configure#ariastrings).

## Your own announcements

`autoAriaDisabled: true` turns off all of it for a zone: the roles, the instructions and the announcements. Use it only when you write your own. If you only want other words, use `ariaStrings` and leave `autoAriaDisabled` off.

With your own announcements, `alertToScreenReader` speaks through the same live region the library uses:

```ts
import { alertToScreenReader } from "@lukez/svelte-dnd";

alertToScreenReader("Moved to the archive");
```

For a zone in an iframe or a popup, pass its document as the second argument: `alertToScreenReader(text, zone.ownerDocument)`. See [other windows](/docs/guides/other-windows).

## The events of a keyboard drag

A keyboard drag calls the same `onconsider` and `onfinalize` as a pointer drag, so the usual handlers, `items = e.items` in both, work for both. The order of the events is different, though:

| When                                       | Event        | Trigger                                                                        |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------ |
| The item is picked up                      | `onconsider` | `DRAG_STARTED`, to its zone                                                    |
| An arrow key moves the item                | `onfinalize` | `DROPPED_INTO_ZONE`, to its zone, with the new order                           |
| Tab moves the item into another zone       | `onfinalize` | `DROPPED_INTO_ANOTHER` to the zone it left, `DROPPED_INTO_ZONE` to the new one |
| The item is dropped (key, Escape, a click) | `onconsider` | `DRAG_STOPPED`, to the zone the item is in                                     |

`e.info.source` is `"keyboard"` (`SOURCES.KEYBOARD`) in all of them. So during a keyboard drag `onfinalize` runs on every move, and the drag ends with an `onconsider`. There is no shadow item: the item itself moves in the list.

A click on another item during a keyboard drag ends the drag with `DRAG_STOPPED`, then starts a drag of the clicked item with `DRAG_STARTED`. If the `DRAG_STOPPED` handler disables dragging in the clicked item's zone, or removes the clicked item, no new drag starts.

## Saving after a drag

Because `onfinalize` runs on every arrow key, do not save to a server on every `onfinalize`. Save at the end of the drag instead: in `onfinalize` for a pointer drag, and in `onconsider` with `DRAG_STOPPED` for a keyboard drag:

```ts
import { SOURCES, TRIGGERS, type DndEvent } from "@lukez/svelte-dnd";

function consider(e: DndEvent<Task>) {
    items = e.items;
    if (e.info.trigger === TRIGGERS.DRAG_STOPPED) void save(e.items);
}

function finalize(e: DndEvent<Task>) {
    items = e.items;
    if (e.info.source === SOURCES.POINTER) void save(e.items);
}
```

With several zones, a keyboard drag that moves an item from one zone to another ends with `DRAG_STOPPED` in the new zone only. Save both lists then, or save each zone's list when its `onfinalize` runs and accept a request per move. The [async save demo](/demos/async-save) uses the pattern above, with a rollback when the save fails.
