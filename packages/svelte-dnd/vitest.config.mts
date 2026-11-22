import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.js"],
        globals: true,
        // Each file runs in its own iframe, so its patched globals (setTimeout, requestAnimationFrame) stay in that file.
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
