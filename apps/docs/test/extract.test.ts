import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ApiDocError, extractApi } from "../src/lib/api/extract.ts";

const fixture = (name: string): string => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const libRoot = new URL("../../../packages/svelte-dnd/", import.meta.url);
const libIndex = fileURLToPath(new URL("src/index.ts", libRoot));

/** The runtime export names that scripts/check-exports.mjs checks the builds against. */
function expectedRuntimeExports(): string[] {
    const script = readFileSync(new URL("scripts/check-exports.mjs", libRoot), "utf8");
    const list = /const EXPECTED = \[([^\]]*)\]/.exec(script);
    if (!list) throw new Error("EXPECTED not found in check-exports.mjs");
    return [...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

describe("extractApi", () => {
    it("reads each kind of export from a documented module", () => {
        const api = extractApi(fixture("ok.ts"));
        expect(Object.keys(api).sort()).toEqual(["Box", "COLOURS", "Count", "Item", "LABEL", "Pair", "SIZES", "wrap"]);

        expect(api.wrap.kind).toBe("function");
        expect(api.wrap.description).toBe("Wraps a value in a box.");
        expect(api.wrap.signature).toContain("wrap<T extends object>(value: T)");

        expect(api.Box.kind).toBe("interface");
        expect(api.Box.signature).toBe("interface Box<T extends object = Item>");
        expect(api.Box.description).toBe("A box that holds one value.");
        expect(api.Box.properties).toEqual([
            { name: "value", type: "T", optional: false, description: "the value in the box" },
            {
                name: "sealed",
                type: "boolean",
                optional: true,
                description: "whether the box is sealed",
                default: "false",
            },
        ]);

        expect(api.Count.kind).toBe("type");
        expect(api.Count.signature).toBe("type Count = number");
        expect(api.Item.kind).toBe("type");

        expect(api.COLOURS.kind).toBe("constant");
        expect(api.COLOURS.properties.map((p) => [p.name, p.type, p.description])).toEqual([
            ["BLUE", '"blue"', "the colour of the sky"],
            ["GREEN", '"green"', "the colour of grass"],
        ]);
    });

    it("lists no properties for a primitive constant", () => {
        const api = extractApi(fixture("ok.ts"));
        expect(api.LABEL.kind).toBe("constant");
        expect(api.LABEL.properties).toEqual([]);
        expect(api.LABEL.signature).toBe('const LABEL: "box"');
    });

    it("prints signatures without member comments, one member per line", () => {
        const api = extractApi(fixture("ok.ts"));
        for (const name of ["COLOURS", "Pair", "SIZES"]) {
            expect(api[name].signature).not.toContain("/*");
        }
        expect(api.COLOURS.signature).toBe(
            'const COLOURS: {\n    readonly BLUE: "blue";\n    readonly GREEN: "green";\n}',
        );
        expect(api.SIZES.signature).toBe("const SIZES: {\n    readonly SMALL: 1;\n    readonly LARGE: 2;\n}");
        expect(api.Pair.signature).toBe("type Pair = {\n    first: number;\n    second: number;\n}");
        expect(api.Pair.properties.map((p) => p.name)).toEqual(["first", "second"]);
    });

    it("lists every missing description in one error", () => {
        let error: unknown;
        try {
            extractApi(fixture("missing.ts"));
        } catch (err) {
            error = err;
        }
        expect(error).toBeInstanceOf(ApiDocError);
        const message = (error as ApiDocError).message;
        expect(message).toContain("Half.undocumented");
        expect(message).toContain("bare");
        expect(message).not.toContain("Half.done");
        expect((error as ApiDocError).missing).toEqual(["Half.undocumented", "bare"]);
    });

    it("covers every public export", () => {
        const typeExports = [
            "Item",
            "Options",
            "TransformDraggedElementFunction",
            "AriaStrings",
            "DndConfig",
            "DndEventInfo",
            "DndEvent",
        ];
        expect(Object.keys(extractApi(libIndex)).sort()).toEqual([...expectedRuntimeExports(), ...typeExports].sort());
    });
});
