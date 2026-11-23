import { createZone } from "../src/action";
import type { Options } from "../src/types";

describe("createZone option validation", () => {
    let node: HTMLElement;
    beforeEach(() => {
        node = document.createElement("ul");
        document.body.appendChild(node);
    });
    afterEach(() => node.remove());

    it("throws when useComputedStyleForRects is not a boolean", () => {
        const options = { items: [{ id: 1 }], useComputedStyleForRects: "yes" as never };
        expect(() => createZone(node, options as Options)).to.throw("useComputedStyleForRects should be a boolean");
    });

    it("throws a clear error when items is not an array", () => {
        const options = { items: { id: 1 } as never };
        expect(() => createZone(node, options as Options)).to.throw(
            "dndzone expects 'items' to be an array but instead it is a object",
        );
    });

    it("names the id key and configure({ idKey }) when an item has no id", () => {
        const options = { items: [{ id: 1 }, { name: "no id" }] as never };
        expect(() => createZone(node, options as Options)).to.throw(
            /missing 'id' property for item .*"no id".*Every item needs a unique 'id'.*configure\(\{ idKey \}\)/s,
        );
    });

    it("throws the missing id error, not a TypeError, for an item that is not an object", () => {
        const options = { items: [{ id: 1 }, null] as never };
        let error: unknown;
        try {
            createZone(node, options as Options);
        } catch (err) {
            error = err;
        }
        expect(error).not.to.be.instanceOf(TypeError);
        expect((error as Error).message).to.contain("missing 'id' property for item null");
    });

    it("accepts a boolean useComputedStyleForRects", () => {
        const zone = createZone(node, { items: [{ id: 1 }], useComputedStyleForRects: true });
        zone.destroy();
    });

    it("accepts an item whose id is inherited (a prototype getter, as RxDB documents have)", () => {
        class Doc {
            constructor(private readonly data: { id: string }) {}
            get id(): string {
                return this.data.id;
            }
        }
        const zone = createZone(node, { items: [new Doc({ id: "a" })] });
        zone.destroy();
    });

    it("names the missing id even when the item cannot be serialised", () => {
        const item: Record<string, unknown> = { name: "no id" };
        item.self = item;
        expect(() => createZone(node, { items: [item] } as unknown as Options)).to.throw("missing 'id'");
    });
});
