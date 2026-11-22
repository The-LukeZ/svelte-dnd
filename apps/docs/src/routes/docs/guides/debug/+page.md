---
title: Debug output
description: Turn on the library's console output to see what a drag does.
section: Guides
order: 17
---

The library logs nothing by default. To see what it does during a drag, turn on its debug output:

```ts
import { configure } from "@lukez/svelte-dnd";

configure({ debug: true });
```

It writes with `console.debug`, so turn on the verbose or debug level in the browser's console to see it. The output names each step: the start of a drag, the zones the item enters and leaves, the index it is over, the drop, and the options of the zone. It also tells you when the library ignores something on purpose, for example a mouse down on an input inside an item, or a [drag handle](/docs/guides/drag-handles) that found no handle zone.

`configure({ debug: false })` turns it off again. The value must be a boolean, and anything else throws.

The setting is global, like every key of `configure`. Turn it on during development only: some messages are built from the whole options object of a zone on each drag. Any page with a zone works for trying it, for example the [basic list](/demos/basic): call `configure({ debug: true })` in its script.
