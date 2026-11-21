import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.js"],
    format: ["esm", "cjs"],
    outDir: "dist",
    target: "es2020",
    minify: false,
    dts: false,
    // Hand-written typings until stage 3 generates them. One copy per format so attw sees matching module kinds.
    async onSuccess() {
        await copyFile("typings/index.d.ts", "dist/index.d.mts");
        await copyFile("typings/index.d.ts", "dist/index.d.cts");
    },
});
