import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const demosRoutes = new URL("../src/routes/docs/demos/", import.meta.url);
const demosLib = new URL("../src/lib/demos/", import.meta.url);

type Page = { slug: string; text: string };

function readPages(): Page[] {
    if (!existsSync(demosRoutes)) return [];
    return readdirSync(demosRoutes, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
            slug: entry.name,
            text: readFileSync(new URL(`${entry.name}/+page.md`, demosRoutes), "utf8"),
        }));
}

const pages = readPages();

describe("demo pages", () => {
    it("exist", () => {
        expect(pages.length).toBeGreaterThan(0);
    });

    describe.each(pages)("$slug", ({ text }) => {
        const component = /import\s+(\w+)\s+from\s+["']#lib\/demos\/(\w+)\.svelte["']/.exec(text);
        const source = /import\s+(\w+)\s+from\s+["']#lib\/demos\/(\w+)\.svelte\?source["']/.exec(text);

        it("imports the demo as a component and with ?source, from the same file", () => {
            expect(component, "component import").not.toBeNull();
            expect(source, "?source import").not.toBeNull();
            expect(source![2]).toBe(component![2]);
        });

        it("renders the demo inside a LiveExample that gets its source", () => {
            const [, componentName, file] = component!;
            const sourceName = source![1];
            const pattern = String.raw`<LiveExample\s+source=\{SRC\}\s*>\s*<COMP\s*/>\s*</LiveExample>`
                .replace("SRC", sourceName)
                .replace("COMP", componentName);
            expect(text).toMatch(new RegExp(pattern));
            expect(existsSync(new URL(`${file}.svelte`, demosLib))).toBe(true);
        });

        it("links to the options reference", () => {
            expect(text).toContain("(/docs/api/options");
        });
    });

    it("keeps every demo to the public API and Svelte", () => {
        const files = existsSync(demosLib) ? readdirSync(demosLib).filter((name) => name.endsWith(".svelte")) : [];
        for (const name of files) {
            const code = readFileSync(fileURLToPath(new URL(name, demosLib)), "utf8");
            const specifiers = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
            for (const specifier of specifiers) {
                const allowed =
                    specifier === "@lukez/svelte-dnd" || specifier === "svelte" || specifier.startsWith("svelte/");
                expect(allowed, `${name} imports ${specifier}`).toBe(true);
            }
        }
    });
});
