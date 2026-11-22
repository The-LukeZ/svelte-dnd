import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    outDir: "dist",
    target: "es2020",
    minify: false,
    dts: true,
});

export default config;
