import { configure } from "../src/configure";
import { createZone } from "../src/action";
import { ITEM_ID_KEY } from "../src/constants";
import { getKeyboardDragTrigger } from "../src/keyboardDragTrigger";
import { destroyAria, initAria } from "../src/helpers/aria";

describe("configure", () => {
    const actions: { destroy(): void }[] = [];
    const zones: HTMLElement[] = [];

    function mountZone() {
        const zone = document.createElement("div");
        zone.appendChild(document.createElement("div"));
        document.body.appendChild(zone);
        zones.push(zone);
        actions.push(createZone(zone, { items: [{ id: 1 }] }));
    }

    function unmountZones() {
        actions.splice(0).forEach((action) => action.destroy());
        zones.splice(0).forEach((zone) => zone.remove());
    }

    afterEach(() => {
        unmountZones();
        configure({ idKey: "id", keyboardDragTrigger: null, ariaStrings: null, debug: false });
    });

    it("leaves keys that are not passed untouched", () => {
        configure({ keyboardDragTrigger: "space" });
        configure({ ariaStrings: null });
        expect(getKeyboardDragTrigger()).to.equal("space");
    });

    it("throws on unknown keys", () => {
        expect(() => configure({ idkey: "key" } as never)).to.throw("idkey");
        for (const key of ["idKey", "keyboardDragTrigger", "ariaStrings", "debug"]) {
            expect(() => configure({ idkey: "key" } as never)).to.throw(key);
        }
    });

    it("throws on unknown keys before applying any key", () => {
        configure({ keyboardDragTrigger: "enter" });
        expect(() => configure({ keyboardDragTrigger: "space", idkey: "key" } as never)).to.throw("idkey");
        expect(getKeyboardDragTrigger()).to.equal("enter");
    });

    it("throws when idKey is set while a zone is mounted", () => {
        mountZone();
        expect(() => configure({ idKey: "key" })).to.throw("can only override the id key");
        expect(ITEM_ID_KEY).to.equal("id");
    });

    it("accepts idKey with no zones", () => {
        configure({ idKey: "key" });
        expect(ITEM_ID_KEY).to.equal("key");
        configure({ idKey: "id" });
        expect(ITEM_ID_KEY).to.equal("id");
    });

    it("throws when idKey is not a string", () => {
        expect(() => configure({ idKey: 7 as never })).to.throw("item id key has to be a string");
    });

    it("keyboardDragTrigger: null restores space_or_enter", () => {
        configure({ keyboardDragTrigger: "enter" });
        expect(getKeyboardDragTrigger()).to.equal("enter");
        configure({ keyboardDragTrigger: null });
        expect(getKeyboardDragTrigger()).to.equal("space_or_enter");
    });

    it("keeps the old validation", () => {
        expect(() => configure({ keyboardDragTrigger: "tab" as never })).to.throw("configure({ keyboardDragTrigger })");
        expect(() => configure({ keyboardDragTrigger: "tab" as never })).to.throw("space_or_enter");
        expect(() => configure({ ariaStrings: 42 as never })).to.throw("configure({ ariaStrings })");
        expect(() => configure({ ariaStrings: 42 as never })).to.throw("42");
    });

    it("ariaStrings updates existing instruction elements immediately", () => {
        initAria();
        try {
            configure({ ariaStrings: { zoneActiveInstruction: "Appuyez sur espace" } });
            expect(document.body.textContent).to.include("Appuyez sur espace");
        } finally {
            destroyAria();
        }
    });

    it("configure({}) and configure({ debug: false }) do not throw with zones mounted", () => {
        mountZone();
        expect(() => configure({})).not.to.throw();
        expect(() => configure({ debug: false })).not.to.throw();
    });

    // browser mode has no window-less realm; configure only assigns module state
    it.skip("runs with no window", () => {});
});
