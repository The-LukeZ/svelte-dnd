# @lukez/svelte-dnd

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
