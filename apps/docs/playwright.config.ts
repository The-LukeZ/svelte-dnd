import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against `vite preview`, which serves SvelteKit's own output in `.svelte-kit`, and check the files in `build/` one by one, so run `pnpm docs:build` first.
export default defineConfig({
    testDir: "smoke",
    forbidOnly: !!process.env.CI,
    reporter: "list",
    use: {
        baseURL: "http://localhost:4173",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: "pnpm preview --port 4173 --strictPort",
        port: 4173,
        reuseExistingServer: !process.env.CI,
    },
});
