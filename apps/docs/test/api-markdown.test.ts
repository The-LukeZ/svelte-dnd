import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { apiEntryMarkdown, expandApiTables, expandUpstreamNotes, withApiTables } from "../src/lib/api/markdown.ts";
import { extractApi } from "../src/lib/api/extract.ts";
import type { ApiReference } from "../src/lib/api/types.ts";

const libIndex = fileURLToPath(new URL("../../../packages/svelte-dnd/src/index.ts", import.meta.url));

const reference: ApiReference = {
    Box: {
        name: "Box",
        kind: "interface",
        signature: "interface Box<T extends object = Item>",
        description: "A box.\n\nIt holds `one` value.",
        properties: [
            { name: "value", type: "T", optional: false, description: "The value." },
            {
                name: "mode",
                type: '"a" | "b"',
                optional: true,
                description: "The mode,\nover two lines.",
                default: '"a"',
            },
            {
                name: "onopen",
                type: "(ctx: {\n    id: number;\n}) => void",
                optional: true,
                description: "Called | when opened.",
            },
        ],
    },
    wrap: {
        name: "wrap",
        kind: "function",
        signature: "function wrap<T>(value: T): Box<T>",
        description: "Wraps a value.",
        properties: [],
    },
};

describe("apiEntryMarkdown", () => {
    it("writes the description, the signature and a property table", () => {
        expect(apiEntryMarkdown(reference.Box)).toBe(
            [
                "A box.",
                "",
                "It holds `one` value.",
                "",
                "```ts",
                "interface Box<T extends object = Item>",
                "```",
                "",
                "| Name | Type | Default | Description |",
                "| --- | --- | --- | --- |",
                "| `value` | `T` | - | The value. |",
                '| `mode?` | `"a" \\| "b"` | `"a"` | The mode, over two lines. |',
                "| `onopen?` | `(ctx: { id: number; }) => void` | - | Called \\| when opened. |",
            ].join("\n"),
        );
    });

    it("leaves the table out when the entry has no properties", () => {
        expect(apiEntryMarkdown(reference.wrap)).toBe(
            ["Wraps a value.", "", "```ts", "function wrap<T>(value: T): Box<T>", "```"].join("\n"),
        );
    });
});

describe("expandApiTables", () => {
    it("replaces each ApiTable tag in prose with its entry", () => {
        const page = [
            "# API",
            "",
            "## wrap",
            "",
            '<ApiTable name="wrap" />',
            "",
            "## Box",
            "",
            "<ApiTable name='Box'/>",
        ];
        const out = expandApiTables(page.join("\n"), reference);
        expect(out).not.toContain("<ApiTable");
        expect(out).toContain(`## wrap\n\n${apiEntryMarkdown(reference.wrap)}\n\n## Box`);
        expect(out.endsWith(apiEntryMarkdown(reference.Box))).toBe(true);
    });

    it("keeps a tag inside a fenced code block", () => {
        const page = ["```svelte", '<ApiTable name="wrap" />', "```"].join("\n");
        expect(expandApiTables(page, reference)).toBe(page);
    });

    it("keeps CRLF line endings", () => {
        const out = expandApiTables('# API\r\n\r\n<ApiTable name="wrap" />\r\n', reference);
        expect(out).toBe(`# API\r\n\r\n${apiEntryMarkdown(reference.wrap).replaceAll("\n", "\r\n")}\r\n`);
    });

    it("throws on an unknown name, so the build fails", () => {
        expect(() => expandApiTables('<ApiTable name="Nope" />', reference)).toThrow(/Nope/);
    });

    it("expands every entry of the real library", () => {
        const real = extractApi(libIndex);
        const page = Object.keys(real)
            .map((name) => `<ApiTable name="${name}" />`)
            .join("\n\n");
        const out = expandApiTables(page, real);
        expect(out).not.toContain("<ApiTable");
        expect(out).toContain("| `items` | `T[]` |");
    });
});

describe("withApiTables", () => {
    it("rewrites the body of a markdown response and keeps its headers", async () => {
        const response = new Response('<ApiTable name="wrap" />', {
            headers: { "content-type": "text/markdown; charset=utf-8" },
        });
        const out = await withApiTables(response, reference);
        expect(out.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
        expect(await out.text()).toBe(apiEntryMarkdown(reference.wrap));
    });

    it("passes a failed response through", async () => {
        const response = new Response("Not found", { status: 404 });
        const out = await withApiTables(response, reference);
        expect(out.status).toBe(404);
        expect(await out.text()).toBe("Not found");
    });
});

describe("expandUpstreamNotes", () => {
    const notes = "## Notes\n\n### 1.0.0\n\nA line.\n";

    it("replaces a Notes tag on its own line with the notes", () => {
        expect(expandUpstreamNotes("Intro.\n\n<Notes />\n", notes)).toBe(
            "Intro.\n\n## Notes\n\n### 1.0.0\n\nA line.\n",
        );
    });

    it("keeps the line endings of the page", () => {
        expect(expandUpstreamNotes("Intro.\r\n\r\n<Notes />", "## A\n\nB")).toBe("Intro.\r\n\r\n## A\r\n\r\nB");
    });

    it("leaves a page without the tag as it is", () => {
        expect(expandUpstreamNotes("Text <Notes /> inline.\n", notes)).toBe("Text <Notes /> inline.\n");
    });
});
