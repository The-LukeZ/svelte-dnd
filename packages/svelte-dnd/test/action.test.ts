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

    it("accepts a boolean useComputedStyleForRects", () => {
        const zone = createZone(node, { items: [{ id: 1 }], useComputedStyleForRects: true });
        zone.destroy();
    });
});
