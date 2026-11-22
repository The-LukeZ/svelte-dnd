import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { SITE_URL } from "../src/site.ts";

const buildDir = fileURLToPath(new URL("../build/", import.meta.url));
const sitemap = readFileSync(buildDir + "sitemap.xml", "utf8");

// adapter-static writes "/" as index.html and every other page as <path>.html (or <path>/index.html).
// `vite preview` serves SvelteKit's own prerendered output, not build/, so this checks the files
// Cloudflare Pages will actually serve.
const builtFile = (path: string) =>
    [path === "/" ? "index.html" : `${path.slice(1)}.html`, `${path.slice(1)}/index.html`].find((file) =>
        existsSync(buildDir + file),
    );

const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(SITE_URL, "") || "/");

// docsmith fetches the GitHub star count on every page, and the repo is private, so
// api.github.com answers 404. That is the only known noise, so only that host is ignored.
// Chromium logs it as a console error ("Failed to load resource") whose location().url is the
// failed URL, and also as a 404 response, so both are matched by host.
const isGithubApi = (url: string) => new URL(url).hostname === "api.github.com";

test("the sitemap lists the whole site", () => {
    expect(paths.length).toBeGreaterThan(20);
});

for (const path of paths) {
    test(path, async ({ page }) => {
        const problems: string[] = [];

        page.on("console", (message) => {
            if (message.type() === "error" && !isGithubApi(message.location().url || SITE_URL)) {
                problems.push(`console: ${message.text()}`);
            }
        });
        page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
        page.on("requestfailed", (request) => {
            if (!isGithubApi(request.url())) problems.push(`requestfailed: ${request.url()}`);
        });
        page.on("response", (response) => {
            if (response.status() >= 400 && !isGithubApi(response.url())) {
                problems.push(`${response.status()}: ${response.url()}`);
            }
        });

        expect(builtFile(path), `build/ has no file for ${path}`).toBeDefined();

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        // page.goto follows redirects silently, so a 308 to a trailing-slash URL must fail here.
        expect(response?.url()).toBe(new URL(path, "http://localhost:4173").href);
        await page.waitForLoadState("networkidle");
        expect(problems).toEqual([]);
    });
}

test("keyboard drag reorders the basic demo", async ({ page }) => {
    await page.goto("/docs/demos/basic");
    // Keys pressed before hydration do nothing, and toPass below only retries the assertion.
    await page.waitForLoadState("networkidle");
    const items = page.locator('ul[aria-label="Basic list"] li');
    const before = (await items.allTextContents()).map((text) => text.trim());
    expect(before.length).toBeGreaterThan(1);

    await items.first().focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    const expected = [before[1], before[0], ...before.slice(2)];
    await expect(async () => {
        expect((await items.allTextContents()).map((text) => text.trim())).toEqual(expected);
    }).toPass();
});
