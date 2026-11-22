# Migrating from `svelte-dnd-action`

`@lukez/svelte-dnd` is a rewrite of the public API for Svelte 5. The drag and drop behavior (pointer, touch, keyboard, aria, scrolling, nested zones, drag handles, other windows) is the same. What changed is how you attach a zone, how you receive updates, and how you configure the library.

This is a draft. The final guide moves into the docs site in a later stage.

## Overview

| `svelte-dnd-action`                                                                          | `@lukez/svelte-dnd`                                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm i svelte-dnd-action`                                                                    | `npm i @lukez/svelte-dnd`                                         |
| Svelte 3, 4 or 5                                                                             | Svelte `^5.32.0`                                                  |
| `use:dndzone={options}`                                                                      | `{@attach dndzone(() => options)}`                                |
| `on:consider`, `on:finalize`, `e.detail`                                                     | `onconsider`, `onfinalize` options, `e`                           |
| `setAriaStrings`, `setKeyboardDragTrigger`, `setDebugMode`, `overrideItemIdKeyNameBefore...` | `configure({ ariaStrings, keyboardDragTrigger, debug, idKey })`   |
| `setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true)`       | `useComputedStyleForRects: true` zone option                      |
| `use:dragHandleZone`, `use:dragHandle`                                                       | `{@attach dragHandleZone(() => options)}`, `{@attach dragHandle}` |

## Package name

Install the new package, remove the old one, and change the import path.

Before:

```js
import { dndzone } from "svelte-dnd-action";
```

After:

```js
import { dndzone } from "@lukez/svelte-dnd";
```

## Svelte version

Attachments need Svelte 5.29, and the `fromAction` helper that `dndzone` is built on needs `^5.32.0`. The package declares `svelte` `^5.32.0` as a peer dependency. Svelte 3 and 4 are not supported.

## The action became an attachment

`dndzone` is no longer an action. It returns an attachment, and you pass it with `{@attach}`. The options go in a function that returns them (a getter), not in a plain object. The library reads the getter inside an effect, so the zone is created once and picks up new options (and a new `items` array) without being torn down in the middle of a drag.

Before:

```svelte
<script>
    import { dndzone } from "svelte-dnd-action";

    let items = [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ];
</script>

<ul use:dndzone={{ items, flipDurationMs: 200 }}>
    {#each items as item (item.id)}
        <li>{item.name}</li>
    {/each}
</ul>
```

After:

```svelte
<script lang="ts">
    import { dndzone } from "@lukez/svelte-dnd";

    let items = $state([
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ]);
</script>

<ul {@attach dndzone(() => ({ items, flipDurationMs: 200 }))}>
    {#each items as item (item.id)}
        <li>{item.name}</li>
    {/each}
</ul>
```

The getter is required. Passing a plain object is a type error.

Reassign `items`, do not change it in place. The library notices a change because the getter reads the `items` binding, so `items = next` works and `items.push(x)` on its own does not. This is the same rule as in `svelte-dnd-action`, and the callbacks below hand you a new array to assign.

## Events became callbacks

The `consider` and `finalize` DOM events are gone. Pass `onconsider` and `onfinalize` in the options instead. The callback receives what `e.detail` used to hold, so `e.detail.items` becomes `e.items` and `e.detail.info` becomes `e.info`.

Before:

```svelte
<script>
    import { dndzone } from "svelte-dnd-action";

    let items = [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ];

    function handleConsider(e) {
        items = e.detail.items;
    }
    function handleFinalize(e) {
        items = e.detail.items;
    }
</script>

<ul use:dndzone={{ items }} on:consider={handleConsider} on:finalize={handleFinalize}>
    {#each items as item (item.id)}
        <li>{item.name}</li>
    {/each}
</ul>
```

After:

```svelte
<script lang="ts">
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Row = { id: number; name: string };

    let items = $state<Row[]>([
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ]);

    function handleConsider(e: DndEvent<Row>) {
        items = e.items;
    }
    function handleFinalize(e: DndEvent<Row>) {
        items = e.items;
    }
</script>

<ul {@attach dndzone(() => ({ items, onconsider: handleConsider, onfinalize: handleFinalize }))}>
    {#each items as item (item.id)}
        <li>{item.name}</li>
    {/each}
</ul>
```

The callbacks fire at the same points as the old events. The library no longer dispatches `consider` or `finalize` on the element, so an `onconsider={...}` attribute on the element does nothing. Put the callbacks in the options.

When you let TypeScript infer the types, the item type flows from `items` into the callbacks, and you can write `onconsider: (e) => (items = e.items)`.

### `info.id` is not typed as a string

`info.id` is the raw value of the item's id key, not a string. Narrow or cast it before string-only use. Items with numeric ids give you a number there.

## Global setters became `configure`

The four global setters are replaced by one function. Keys that you leave out are not touched, so `configure({ ariaStrings })` on a locale change leaves the keyboard trigger as it was.

| Before                                               | After                                   |
| ---------------------------------------------------- | --------------------------------------- |
| `overrideItemIdKeyNameBeforeInitialisingDndZones(k)` | `configure({ idKey: k })`               |
| `setKeyboardDragTrigger(t)`                          | `configure({ keyboardDragTrigger: t })` |
| `setAriaStrings(s)`                                  | `configure({ ariaStrings: s })`         |
| `setDebugMode(b)`                                    | `configure({ debug: b })`               |

Before:

```js
import {
    overrideItemIdKeyNameBeforeInitialisingDndZones,
    setKeyboardDragTrigger,
    setAriaStrings,
    setDebugMode,
} from "svelte-dnd-action";

overrideItemIdKeyNameBeforeInitialisingDndZones("key");
setKeyboardDragTrigger("enter");
setAriaStrings({ zoneActiveInstruction: "Press enter to pick up an item" });
setDebugMode(true);
```

After:

```js
import { configure } from "@lukez/svelte-dnd";

configure({
    idKey: "key",
    keyboardDragTrigger: "enter",
    ariaStrings: { zoneActiveInstruction: "Press enter to pick up an item" },
    debug: true,
});
```

Behavior to know about:

- `keyboardDragTrigger` is `"space"`, `"enter"` or `"space_or_enter"` (the default). `null` restores the default.
- `ariaStrings` is a full locale over the English defaults. `null` restores English.
- `idKey` throws while any zone is mounted, as before. Call it once at app start. A value that is not a string throws too.
- An unknown key throws, so a typo fails loudly.
- `configure` only sets module state and touches no DOM, so it is safe to call during SSR.

## The feature flag became a zone option

`setFeatureFlag` and `FEATURE_FLAG_NAMES` are removed. The only flag, `USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT`, is now the `useComputedStyleForRects` option of the zone. It is a workaround for grid layouts, so set it on the zone that has the grid. Other zones keep the default (`false`).

Before:

```js
import { setFeatureFlag, FEATURE_FLAG_NAMES } from "svelte-dnd-action";

setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);
```

After:

```svelte
<script lang="ts">
    import { dndzone } from "@lukez/svelte-dnd";

    let items = $state([
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ]);
</script>

<div class="grid" {@attach dndzone(() => ({ items, useComputedStyleForRects: true }))}>
    {#each items as item (item.id)}
        <div>{item.name}</div>
    {/each}
</div>
```

## Drag handles are attachments

`dragHandleZone` and `dragHandle` are attachments too. Put `{@attach dragHandleZone(() => options)}` on the zone and `{@attach dragHandle}` on each handle element. `dragHandle` is used as it is, without a function call.

Before:

```svelte
<script>
    import { dragHandleZone, dragHandle } from "svelte-dnd-action";

    let items = [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ];
</script>

<ul
    use:dragHandleZone={{ items }}
    on:consider={(e) => (items = e.detail.items)}
    on:finalize={(e) => (items = e.detail.items)}
>
    {#each items as item (item.id)}
        <li>
            <span use:dragHandle aria-label="drag handle for {item.name}">::</span>
            {item.name}
        </li>
    {/each}
</ul>
```

After:

```svelte
<script lang="ts">
    import { dragHandleZone, dragHandle } from "@lukez/svelte-dnd";

    let items = $state([
        { id: 1, name: "a" },
        { id: 2, name: "b" },
    ]);
</script>

<ul
    {@attach dragHandleZone(() => ({
        items,
        onconsider: (e) => (items = e.items),
        onfinalize: (e) => (items = e.items),
    }))}
>
    {#each items as item (item.id)}
        <li>
            <span {@attach dragHandle} aria-label="drag handle for {item.name}">::</span>
            {item.name}
        </li>
    {/each}
</ul>
```

A handle finds the nearest handle zone around it. A handle outside any handle zone does nothing (it warns once when `debug` is on).

### `dragDisabled` is per handle zone

Before, the `dragDisabled` option of one handle zone leaked into the handles of every other handle zone on the page. Now it applies to the handles of its own zone only. A zone with `dragDisabled: true` stops its own handles and leaves the others alone.

Nested handle zones follow the same rule: the handles inside an inner zone answer to the inner zone's `dragDisabled`, and the outer zone's `dragDisabled` does not reach them.

Dragging an item from one handle zone into another still works. While a drag is running, every handle zone accepts it, and all of them are disabled again when it ends.

```svelte
<script lang="ts">
    import { dragHandleZone, dragHandle } from "@lukez/svelte-dnd";

    let left = $state([{ id: 1, name: "a" }]);
    let right = $state([{ id: 2, name: "b" }]);
    let leftLocked = $state(true);
</script>

<ul
    {@attach dragHandleZone(() => ({
        items: left,
        dragDisabled: leftLocked,
        onconsider: (e) => (left = e.items),
        onfinalize: (e) => (left = e.items),
    }))}
>
    {#each left as item (item.id)}
        <li><span {@attach dragHandle}>::</span> {item.name}</li>
    {/each}
</ul>

<ul
    {@attach dragHandleZone(() => ({
        items: right,
        onconsider: (e) => (right = e.items),
        onfinalize: (e) => (right = e.items),
    }))}
>
    {#each right as item (item.id)}
        <li><span {@attach dragHandle}>::</span> {item.name}</li>
    {/each}
</ul>
```

Here the handles of the left list are locked, and the handles of the right list still work.

## Type changes

- The public generics take `T extends object`, so an `interface` works as an item type. Before, only types with an index signature did.
- `transformDraggedElement` receives the zone's item type: `TransformDraggedElementFunction<T>` is `(element?, draggedElementData?: T, index?) => void`.
- `DndZoneAttributes` is removed. There are no event attributes left to type.
- `DndEventInfo.id` is no longer typed `string`, see above.
- New types: `DndConfig` (the argument of `configure`).

## Removed exports

| Removed                                                                                                       | Use instead                                        |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `setAriaStrings`, `setKeyboardDragTrigger`, `setDebugMode`, `overrideItemIdKeyNameBeforeInitialisingDndZones` | `configure`                                        |
| `setFeatureFlag`, `FEATURE_FLAG_NAMES`                                                                        | the `useComputedStyleForRects` zone option         |
| type `DndZoneAttributes`                                                                                      | nothing, `onconsider` and `onfinalize` are options |

Still exported and unchanged: `alertToScreenReader`, `TRIGGERS`, `SOURCES`, `SHADOW_ITEM_MARKER_PROPERTY_NAME`, `SHADOW_PLACEHOLDER_ITEM_ID`, `DRAGGED_ELEMENT_ID`, and the types `Options`, `DndEvent`, `DndEventInfo`, `AriaStrings`, `Item`, `TransformDraggedElementFunction`.

All other zone options keep their names and meaning.
