import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.js"],
        globals: true,
        // Several tests patch window.setTimeout or open popups, so files run one at a time.
        fileParallelism: false,
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            viewport: { width: 1000, height: 660 },
            instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
        },
    },
});
