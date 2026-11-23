import { userEvent } from "vitest/browser";
import { dndzone } from "../src/pointerAction";
import { DRAGGED_ELEMENT_ID } from "../src/constants";

describe("wheel scrolling while dragging", () => {
    it("scrolls the zone's scroll container when the wheel turns over the dragged element", async () => {
        document.body.style.margin = "0";
        // the scroll container is the only thing that can scroll, the page does not overflow
        const scroller = document.createElement("div");
        scroller.style.cssText = "position: absolute; top: 0; left: 0; width: 200px; height: 200px; overflow: auto";
        const zone = document.createElement("div");
        const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
        for (const { id } of items) {
            const el = document.createElement("div");
            el.style.cssText = "height: 50px";
            el.textContent = `item ${id}`;
            zone.appendChild(el);
        }
        scroller.appendChild(zone);
        document.body.appendChild(scroller);
        const action = dndzone(zone, { items, flipDurationMs: 0 });
        try {
            const item = zone.children[1] as HTMLElement;
            item.dispatchEvent(
                new MouseEvent("mousedown", { button: 0, clientX: 100, clientY: 75, bubbles: true, cancelable: true }),
            );
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 80, bubbles: true }));
            const draggedEl = document.getElementById(DRAGGED_ELEMENT_ID)!;
            expect(draggedEl, "the drag should have started").toBeTruthy();
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await userEvent.wheel(draggedEl, { delta: { y: 100 } });
            await expect.poll(() => scroller.scrollTop, { timeout: 1000 }).to.be.greaterThan(0);
        } finally {
            window.dispatchEvent(new MouseEvent("mouseup", { clientX: 100, clientY: 80, bubbles: true }));
            action.destroy();
            scroller.remove();
        }
    });
});
