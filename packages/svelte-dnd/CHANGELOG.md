# @lukez/svelte-dnd

## 1.1.0

### Minor Changes

- 5e434cf: `configure` takes two new global settings for the auto-scroll of a pointer drag: `autoScrollEdgePx` sets how close to the edge of a scrolling container or the page scrolling starts, and `autoScrollMaxStepPx` sets how many pixels it scrolls per frame with the pointer at the edge. Both default to 30, which keeps the current behaviour, and `null` restores the default.
- cf3668a: The `onfinalize` events of a pointer drag carry `e.info.pointerPosition`, the `{ x, y }` viewport coordinates of the pointer when the item was dropped. Use it to place a dropped item where it was dropped, for example on a canvas outside of any zone. The property is optional on `DndEventInfo`: `onconsider` events and keyboard drags do not have it.
- bcc1c99: New zone option `keyboardDragDisabled`: turns keyboard dragging off for a zone and keeps pointer dragging. The zone leaves Space, Enter, the arrow keys and item clicks to the app, does not take items that a keyboard drag tabs into it, and describes itself to screen readers like a zone with `dragDisabled`. In a `dragHandleZone` its handles leave the tab order. It defaults to `false`, so nothing changes for existing zones.
- c7a5d88: New zone option `lockAxis`: `"y"` keeps a pointer drag of the zone's items moving only up and down, `"x"` only left and right. The detection point, auto scrolling and the resizing of the dragged element over items of another size stay on that axis too, and `centreDraggedOnCursor` centres along the free axis only. It is unset by default, so drags stay free.

### Patch Changes

- 4aabf32: Clearer errors for invalid `items`. A non-array `items` now throws "dndzone expects 'items' to be an array" instead of "items.find is not a function". A `null` or non-object item throws the missing id error instead of a `TypeError`. The missing id error now gives the item's index and points to `configure({ idKey })`.
- 59db0a9: An item whose `id` it inherits, such as a getter on its class (RxDB documents, for one), no longer fails the options check with "missing 'id' property". The check used to look for an own property only. The error for an item that really has no id now also reads correctly when the item cannot be turned into JSON, for example because it is circular, instead of throwing "Converting circular structure to JSON".
  
  The shadow item of such an item now keeps its class too, so fields it inherits, like a `title` getter, still render in the placeholder during a pointer drag. Before, the placeholder was a plain copy of the item's own properties.
- f8a05b5: A drop no longer removes the dragged item's element from a zone that never re-rendered it away, for example when its items are not reactive or its `#each` block is not keyed.
- c7cc36b: Faster drag in long lists. Finding the index under the dragged item now measures the scroll containers above the zone once per check, not once per item. In a list of 1600 items ten elements below a scroller, one check went from 23 to 40 ms down to about 10 ms in Chromium.
- 9435687: A shadow element that is smaller than the items around it no longer gets stuck while the pointer moves past whole items: it moves next to the item under the pointer.
- 0111a27: A zone on a `<svelte:element>` no longer leaves items hidden during and after a pointer drag. Svelte runs the attachment's update before the element's children there, so the shadow item's styling landed on the wrong item. `dndzone` and `dragHandleZone` now hand each update to the zone in a microtask, once Svelte has rendered the new items. This changes the timing on every element, not only on `<svelte:element>`:
  
  - The first options apply at once, when the zone is created. Right after a later state change, even after `flushSync()`, the zone still works with its previous options. It has the new ones from the next microtask on: `await tick()` after the change is enough. Several updates in one flush reach the zone as one update with the latest options.
  - The options are still checked when they are given, so an invalid option, such as an item without an id, still throws from the attachment's effect, where a `<svelte:boundary>` can catch it. An error the zone throws later while it applies valid options has no caller in the microtask, and is reported to the window's `error` event instead.
- b05d55d: Turning the mouse wheel during a pointer drag now scrolls the scroll container under the dragged element, such as a zone inside a scrollable div. Before, the wheel event hit the dragged element, which lives outside those containers, so only the page could scroll. The shadow item then moves to the item that the scroll brings under the pointer. When no container under the pointer can scroll, the browser scrolls the page as before.
- d7d7ed0: A zone created while a pointer drag is running, such as the children of a tree node that expands on hover, now takes part in the drag. Before, the library only watched the zones that existed when the drag started, so the new zone got no `onconsider` and could not take the drop. It now also gets the drop target styling, and a longer `flipDurationMs` of its own slows the drag detection down to it, as it does for the zones there at the start, so its items do not jump back and forth.

## 1.0.1

### Patch Changes

- 3cff0e5: Point the package homepage and README links at the new docs domain, https://svelte-dnd.js.org.

## 1.0.0

### Major Changes

- 69ff5d0: First stable release of the Svelte 5 rewrite of `svelte-dnd-action`. Zones and drag handles are attachments (`dndzone`, `dragHandleZone`, `dragHandle`), updates arrive through the `onconsider` and `onfinalize` options, and global settings go through `configure`.
  
  Read the [documentation](https://svelte-dnd.js.org) to get started, or the [migration guide](https://svelte-dnd.js.org/docs/migrating) to move from `svelte-dnd-action`. See `1.0.0-next.0` below for the full list of changes since the fork.

### Patch Changes

- 2b991eb: `useComputedStyleForRects` now also applies when a pointer drag starts: the dragged clone takes the item's computed width, height and box-sizing instead of its bounding rect. Before, the clone was sized from the rect at drag start, and the option only took effect on the first morph.
- 7f1c01b: A click on another item during a keyboard drag now ends the drag with an `onconsider` whose trigger is `DRAG_STOPPED` before it starts a drag of the clicked item. Before, the first drag ended without one, so code that saves on `DRAG_STOPPED` missed its moves. No new drag starts if that handler disables dragging in the clicked item's zone or removes the item.
- 18d177a: A pointer drag now scrolls a page that only overflows horizontally when the page's scroll width is not more than the window's height, as in a portrait window. Before, the check compared the scroll width with the client height.

## 1.0.0-next.0

### Major Changes

- cc2bc98: Fork `svelte-dnd-action` 0.9.80 as `@lukez/svelte-dnd`. The package now ships ESM and CommonJS builds from `dist` only (the `svelte` field and raw `src` entry are gone) and is moving to a breaking Svelte 5 rewrite. Expect API changes between `next` prereleases.
- a221e26: Rewrite the public API for Svelte 5. See [MIGRATING.md](https://github.com/The-LukeZ/svelte-dnd/blob/master/packages/svelte-dnd/MIGRATING.md) for the steps.
  
  - The action became an attachment factory that takes an options getter: `use:dndzone={options}` is now `{@attach dndzone(() => options)}`. The same applies to `dragHandleZone`.
  - The `consider` and `finalize` DOM events became the `onconsider` and `onfinalize` options. They receive the event directly, so `e.detail.items` is now `e.items`.
  - The global setters `setAriaStrings`, `setKeyboardDragTrigger`, `setDebugMode` and `overrideItemIdKeyNameBeforeInitialisingDndZones` became `configure({ ariaStrings, keyboardDragTrigger, debug, idKey })`.
  - `setFeatureFlag` and `FEATURE_FLAG_NAMES` became the per-zone `useComputedStyleForRects` option.
  - Drag handles are attachments: `{@attach dragHandle}` inside a `dragHandleZone`. `dragDisabled` applies to that zone's handles only.
  - Types: the public generics take `T extends object`, so interfaces work as item types, and `transformDraggedElement` receives the zone's item type. `DndEventInfo` takes the item type, and `info.id` is inferred from the item's `id` field (`unknown` for items without one, as with a custom `idKey`) instead of typed `string`. `Item` is `Record<string, unknown>` instead of `Record<string, any>`, so code that leaves the item type out, such as `(e: DndEvent) => e.items[0].name`, no longer compiles: pass the item type. `DndZoneAttributes` is removed.
  - Requires `svelte` `^5.32`.

### Patch Changes

- 511812d: `configure` now checks every key and value before applying any, so a call that throws no longer leaves some settings changed.
- 2686471: A zone created on an element during the drop animation of a drag from the previous zone on it no longer receives that drag's finalize event or loses its registration when the drop ends.
- 934a1e4: A handle zone created again on the same element now takes over the handles of the zone it replaces.
- a77c37d: `info.id` is inferred from an optional `id` field too.
- f2db62c: A zone nested in an element marked with the shadow item hint is now set up once the hint is removed. Before, the dropped item's nested zone stayed dead after the drop (#7).
- 6c1b467: A zone created with a different `type` on an element during the drop animation of a drag from the previous zone on it no longer leaves the old type registered, which kept `configure({ idKey })` throwing and broke the next drag of that type.
