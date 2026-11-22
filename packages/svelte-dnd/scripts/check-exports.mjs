// Checks that the ESM and CJS builds export exactly the public API of src/index.js.
import { createRequire } from "node:module";

const EXPECTED = [
    "dndzone",
    "dragHandleZone",
    "dragHandle",
    "alertToScreenReader",
    "configure",
    "TRIGGERS",
    "SOURCES",
    "SHADOW_ITEM_MARKER_PROPERTY_NAME",
    "SHADOW_PLACEHOLDER_ITEM_ID",
    "DRAGGED_ELEMENT_ID",
].sort();

const require = createRequire(import.meta.url);
const builds = {
    esm: Object.keys(await import("../dist/index.mjs")),
    cjs: Object.keys(require("../dist/index.cjs")).filter((key) => key !== "__esModule"),
};

let failed = false;
for (const [format, keys] of Object.entries(builds)) {
    const missing = EXPECTED.filter((name) => !keys.includes(name));
    const extra = keys.filter((name) => !EXPECTED.includes(name));
    if (missing.length || extra.length) {
        failed = true;
        console.error(`${format}: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`);
    }
}

if (failed) process.exit(1);
console.log(`exports ok (${EXPECTED.length})`);
