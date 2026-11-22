---
"@lukez/svelte-dnd": major
---

Rewrite the public API for Svelte 5. See `MIGRATING.md` for the steps.

- The action became an attachment factory that takes an options getter: `use:dndzone={options}` is now `{@attach dndzone(() => options)}`. The same applies to `dragHandleZone`.
- The `consider` and `finalize` DOM events became the `onconsider` and `onfinalize` options. They receive the event directly, so `e.detail.items` is now `e.items`.
- The global setters `setAriaStrings`, `setKeyboardDragTrigger`, `setDebugMode` and `overrideItemIdKeyNameBeforeInitialisingDndZones` became `configure({ ariaStrings, keyboardDragTrigger, debug, idKey })`.
- `setFeatureFlag` and `FEATURE_FLAG_NAMES` became the per-zone `useComputedStyleForRects` option.
- Drag handles are attachments: `{@attach dragHandle}` inside a `dragHandleZone`. `dragDisabled` applies to that zone's handles only.
- Types: the public generics take `T extends object`, so interfaces work as item types, and `transformDraggedElement` receives the zone's item type. `DndEventInfo.id` is `unknown`, the value of the item's id key. `DndZoneAttributes` is removed.
- Requires `svelte` `^5.32`.
