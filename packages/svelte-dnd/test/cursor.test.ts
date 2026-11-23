import { dndzone } from "../src/pointerAction";
import { DRAGGED_ELEMENT_ID } from "../src/constants";

// Upstream issue isaacHagoel/svelte-dnd-action#662: the cursor over the items can be changed with CSS. The library sets
// the cursor inline, so a stylesheet rule needs !important, as the styling guide shows.
describe("item cursor", () => {
    const cleanups: (() => void)[] = [];
    afterEach(() => {
        window.dispatchEvent(new MouseEvent("mouseup", { clientX: 0, clientY: 0 }));
        cleanups
            .splice(0)
            .reverse()
            .forEach((cleanup) => cleanup());
    });

    function addStyle(css: string): void {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
        cleanups.push(() => style.remove());
    }

    function createZone() {
        const zone = document.createElement("div");
        const item = document.createElement("div");
        item.className = "card";
        item.style.cssText = "width: 50px; height: 50px;";
        zone.appendChild(item);
        document.body.appendChild(zone);
        const action = dndzone(zone, { items: [{ id: 1 }], dropAnimationDisabled: true });
        cleanups.push(() => {
            action.destroy();
            zone.remove();
        });
        return item;
    }

    function startDrag(item: HTMLElement): HTMLElement {
        const init = { button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true };
        item.dispatchEvent(new MouseEvent("mousedown", init));
        window.dispatchEvent(new MouseEvent("mousemove", { ...init, clientX: 15, clientY: 15 }));
        return document.getElementById(DRAGGED_ELEMENT_ID)!;
    }

    it("shows grab over the items and grabbing while dragging by default", () => {
        const item = createZone();
        expect(getComputedStyle(item).cursor).to.equal("grab");
        expect(getComputedStyle(startDrag(item)).cursor).to.equal("grabbing");
    });

    it("takes the cursor of a stylesheet rule with !important, and the dragged element keeps grabbing", () => {
        addStyle(`
            .card:not(#${DRAGGED_ELEMENT_ID}) { cursor: pointer !important; }
        `);
        const item = createZone();
        expect(getComputedStyle(item).cursor).to.equal("pointer");
        expect(getComputedStyle(startDrag(item)).cursor).to.equal("grabbing");
    });

    it("styles the dragged element's cursor through its id", () => {
        addStyle(`#${DRAGGED_ELEMENT_ID} { cursor: move !important; }`);
        const item = createZone();
        expect(getComputedStyle(startDrag(item)).cursor).to.equal("move");
    });
});
