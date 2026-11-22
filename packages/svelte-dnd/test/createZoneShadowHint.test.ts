import { createZone } from "../src/action";
import { SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME } from "../src/constants";
import type { Item, Options } from "../src/types";

/** MutationObserver callbacks run as microtasks: one macrotask later they have all run. */
const settle = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

/** createZone gives a zone it sets up an `aria-describedby` (autoAria is on by default). A waiting zone has none. */
const isSetUp = (node: HTMLElement): boolean => node.hasAttribute("aria-describedby");

function options(overrides: Partial<Options> = {}): Options {
    return { items: [{ id: 1 }], onconsider: () => {}, onfinalize: () => {}, ...overrides };
}

/** outer > hinted > zone, with the shadow hint on `hinted`. */
function setup() {
    const outer = document.createElement("div");
    const hinted = document.createElement("div");
    const node = document.createElement("ul");
    node.appendChild(document.createElement("li"));
    hinted.setAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME, "true");
    hinted.appendChild(node);
    outer.appendChild(hinted);
    document.body.appendChild(outer);
    return { outer, hinted, node };
}

describe("createZone inside the shadow hint", () => {
    let errors: string[];
    const onError = (e: ErrorEvent): number => errors.push(e.message);
    let zones: { destroy(): void }[];
    beforeEach(() => {
        errors = [];
        zones = [];
        window.addEventListener("error", onError);
    });
    afterEach(() => {
        zones.forEach((z) => z.destroy());
        window.removeEventListener("error", onError);
        document.body.innerHTML = "";
        expect(errors, "uncaught errors").to.deep.equal([]);
    });

    it("waits while the hint is set and sets up the zone once it is removed", async () => {
        const { hinted, node } = setup();
        zones.push(createZone(node, options()));
        await settle();
        expect(isSetUp(node), "waiting").to.equal(false);
        hinted.removeAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME);
        await settle();
        expect(isSetUp(node), "set up").to.equal(true);
    });

    it("a zone destroyed while waiting is never set up", async () => {
        const { hinted, node } = setup();
        const zone = createZone(node, options());
        zone.destroy();
        hinted.removeAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME);
        await settle();
        expect(isSetUp(node)).to.equal(false);
    });

    it("a zone updated while waiting is set up with the latest options", async () => {
        const { hinted, node } = setup();
        const zone = createZone(node, options({ zoneTabIndex: 1 }));
        zones.push(zone);
        zone.update(options({ zoneTabIndex: 7 }));
        hinted.removeAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME);
        await settle();
        expect(isSetUp(node)).to.equal(true);
        expect(node.tabIndex).to.equal(7);
    });

    it("keeps waiting when the hint moves to another ancestor", async () => {
        const { outer, hinted, node } = setup();
        zones.push(createZone(node, options()));
        outer.setAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME, "true");
        hinted.removeAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME);
        await settle();
        expect(isSetUp(node), "still waiting on the outer hint").to.equal(false);
        outer.setAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME, "false");
        await settle();
        expect(isSetUp(node), "set up").to.equal(true);
    });

    it("validates the options while waiting", () => {
        const { node } = setup();
        expect(() => createZone(node, options({ items: [{ name: "no id" } as unknown as Item] }))).to.throw(
            "missing 'id'",
        );
        const zone = createZone(node, options());
        zones.push(zone);
        expect(() => zone.update(options({ items: [{ name: "no id" } as unknown as Item] }))).to.throw("missing 'id'");
    });

    it("invalid options while waiting do not stop the zone from being set up later", async () => {
        const { hinted, node } = setup();
        const zone = createZone(node, options());
        zones.push(zone);
        expect(() => zone.update(options({ items: [{ name: "no id" } as unknown as Item] }))).to.throw();
        hinted.removeAttribute(SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME);
        await settle();
        expect(isSetUp(node), "set up with the last valid options").to.equal(true);
    });
});
