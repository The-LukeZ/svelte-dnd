import { userEvent } from "vitest/browser";
import { dndzone } from "../src/pointerAction";
import { DRAGGED_ELEMENT_ID, SHADOW_ELEMENT_ATTRIBUTE_NAME } from "../src/constants";
import type { DndEvent, Options } from "../src/types";

const mouse = (type: string, x: number, y: number) =>
    new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// a zone in a scroll container that renders its items from the events, as a framework does
function renderedZoneIn(scroller: HTMLElement, rows: { id: number }[], options: Partial<Options> = {}) {
    const zone = document.createElement("div");
    scroller.appendChild(zone);
    const elements = new Map<string, HTMLElement>();
    let current: Options;
    function render(items: { id: number }[]): void {
        zone.replaceChildren(
            ...items.map((item) => {
                const key = String(item.id) + ((item as Record<string, unknown>).isDndShadowItem ? "_shadow" : "");
                let el = elements.get(key);
                if (!el) {
                    el = document.createElement("div");
                    el.style.cssText = "height: 50px";
                    el.textContent = String(item.id);
                    elements.set(key, el);
                }
                return el;
            }),
        );
    }
    render(rows);
    const handle = (e: DndEvent): void => {
        current = { ...current, items: e.items };
        render(e.items as { id: number }[]);
        action.update(current);
    };
    current = { ...options, items: rows, dropAnimationDisabled: true, onconsider: handle, onfinalize: handle };
    const action = dndzone(zone, current);
    return { zone, elementOf: (id: number) => elements.get(String(id))!, destroy: () => action.destroy() };
}

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

    // isaacHagoel/svelte-dnd-action#583: the wheel scrolls the items under a pointer that does not move
    it("moves the shadow item to the item that a wheel scroll brings under the pointer", async () => {
        document.body.style.margin = "0";
        // the drop animation of the test before has to end first
        await vi.waitFor(() => expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null));
        const scroller = document.createElement("div");
        scroller.style.cssText = "position: fixed; top: 0; left: 0; width: 100px; height: 400px; overflow: auto";
        document.body.appendChild(scroller);
        const list = renderedZoneIn(
            scroller,
            Array.from({ length: 20 }, (_, i) => ({ id: i })),
            { useCursorForDetection: true },
        );
        const shadowIndex = () =>
            Array.from(list.zone.children).findIndex((c) => c.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME));
        const indexUnder = (y: number) =>
            Array.from(list.zone.children).findIndex((c) => {
                const r = c.getBoundingClientRect();
                return y >= r.top && y < r.bottom;
            });
        try {
            const one = list.elementOf(1);
            one.dispatchEvent(mouse("mousedown", 50, 75));
            window.dispatchEvent(mouse("mousemove", 50, 81));
            for (let i = 0; i < 30 && !(one.isConnected && one.style.display === "none"); i++) await nextFrame();
            window.dispatchEvent(mouse("mousemove", 50, 175));
            await sleep(300);
            expect(shadowIndex(), "the shadow item is under the pointer before the wheel").to.equal(3);

            document
                .getElementById(DRAGGED_ELEMENT_ID)!
                .dispatchEvent(
                    new WheelEvent("wheel", { deltaY: 50, clientX: 50, clientY: 175, bubbles: true, cancelable: true }),
                );
            expect(scroller.scrollTop, "the wheel scrolled the container").to.equal(50);
            await sleep(400);
            expect(shadowIndex(), "the shadow item follows the items under the still pointer").to.equal(
                indexUnder(175),
            );
            // a small move after the scroll decides with the item positions after it
            window.dispatchEvent(mouse("mousemove", 50, 60));
            await sleep(400);
            expect(shadowIndex(), "the shadow item is under the pointer").to.equal(indexUnder(60));
        } finally {
            window.dispatchEvent(mouse("mouseup", 0, 0));
            list.destroy();
            scroller.remove();
        }
    });
});
