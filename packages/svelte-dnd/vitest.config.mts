import { playwright } from "@vitest/browser-playwright";
import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
    test: {
        include: ["test/**/*.test.js"],
        globals: true,
        // Vitest's default, kept explicit: files run in parallel. Each file runs in its own iframe, so its patched globals
        // (setTimeout, requestAnimationFrame) stay in that file.
        fileParallelism: true,
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            viewport: { width: 1000, height: 660 },
            instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
        },
    },
});

export default config;
