import { defineConfig } from "vitest/config";

// The unit tests run in Node, without the SvelteKit plugins of vite.config.ts.
export default defineConfig({
    test: {
        environment: "node",
        include: ["test/**/*.test.ts"],
    },
});
