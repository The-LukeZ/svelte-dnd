import { render } from "vitest-browser-svelte";
import type { DndEvent } from "../../src/types";
import NestedInShadow from "./fixtures/NestedInShadow.svelte";

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function mouse(type: string, x: number, y: number): MouseEvent {
    return new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
}

/**
 * Zones that engine setup ran for: createZone gives every zone it does not ignore an `aria-describedby` (autoAria is on
 * by default). A zone skipped through the shadow hint gets none.
 */
function createdZonesIn(outer: HTMLElement): number {
    return outer.querySelectorAll("ul[aria-describedby]").length;
}

describe("shadow hint", () => {
    let errors: string[];
    const onError = (e: ErrorEvent): number => errors.push(e.message);
    beforeEach(() => {
        errors = [];
        window.addEventListener("error", onError);
    });
    afterEach(() => {
        window.removeEventListener("error", onError);
        expect(errors, "errors thrown by listeners").to.deep.equal([]);
    });

    /** Drags the first outer item to the end, finalizes the drop and returns how many inner zones were set up mid-drag. */
    async function dragFirstToEnd(hint: boolean, onInnerCall?: (kind: string) => void) {
        const calls: { kind: string; detail: DndEvent }[] = [];
        const screen = await render(NestedInShadow, {
            hint,
            onCall: (kind: string, detail: DndEvent) => calls.push({ kind, detail }),
            onInnerCall,
        });
        const outer = screen.getByTestId("outer").element() as HTMLElement;
        expect(createdZonesIn(outer), "inner zones before the drag").to.equal(3);

        const items = Array.from(outer.children) as HTMLElement[];
        const first = items[0].getBoundingClientRect();
        const last = items[items.length - 1].getBoundingClientRect();
        const x = first.left + 5;
        const startY = first.top + 5;
        const endY = last.bottom - 2;
        let during = -1;
        items[0].dispatchEvent(mouse("mousedown", x, startY));
        try {
            window.dispatchEvent(mouse("mousemove", x, startY + 5));
            await vi.waitFor(() => expect(calls.length, "the drag should start").to.be.greaterThan(0));
            for (let y = startY + 20; y <= endY; y += 20) {
                window.dispatchEvent(mouse("mousemove", x, y));
                await sleep(30);
            }
            window.dispatchEvent(mouse("mousemove", x, endY));
            await sleep(100);
            // the shadow item holds an inner zone element in both runs: only the setup differs
            expect(outer.querySelectorAll('[data-is-dnd-shadow-item-hint="true"]').length).to.equal(hint ? 1 : 0);
            expect(outer.querySelectorAll("li > ul").length, "inner zone elements").to.equal(3);
            during = createdZonesIn(outer);
        } finally {
            window.dispatchEvent(mouse("mouseup", x, endY));
        }
        await vi.waitFor(() => expect(calls[calls.length - 1].kind).to.equal("finalize"), { timeout: 3000 });
        return { during, outer, calls };
    }

    /**
     * Svelte 5 does create the zone nested in the shadow item: a drag without the hint attribute (second test) sets up
     * 3 inner zones, one under the shadow item. With the hint (this test) the nested zone is skipped, so 2 inner zones
     * are set up for the 2 real items. Zones are counted by the `aria-describedby` that createZone sets on a zone it did
     * not skip. The hint check stays.
     */
    it("a zone nested in a shadow item registers no duplicate zone during a drag", { timeout: 10000 }, async () => {
        // 3 items while dragging: 2 real ones and the shadow, whose inner zone element is left alone
        expect((await dragFirstToEnd(true)).during).to.equal(2);
    });

    it("without the hint, Svelte 5 sets up the zone nested in the shadow item", { timeout: 10000 }, async () => {
        expect((await dragFirstToEnd(false)).during).to.equal(3);
    });

    /**
     * https://github.com/The-LukeZ/svelte-dnd/issues/7. With the hint, the zone nested in the shadow item is skipped
     * while the hint is set. After the drop the shadow item's element stays as the dropped item's element and loses the
     * hint, so its nested zone must be set up then, and accept a drag.
     */
    it("with the hint, the dropped item's nested zone is set up after the drop (#7)", { timeout: 10000 }, async () => {
        const innerCalls: string[] = [];
        const { outer, calls } = await dragFirstToEnd(true, (kind) => innerCalls.push(kind));
        // the drop happened
        const finalize = calls[calls.length - 1];
        expect(finalize.kind).to.equal("finalize");
        expect(finalize.detail.info.id, "the dropped item").to.equal("o1");
        await vi.waitFor(() =>
            expect(outer.querySelectorAll('[data-is-dnd-shadow-item-hint="true"]').length).to.equal(0),
        );
        const dropped = Array.from(outer.children).find((li) => li.firstChild!.textContent!.trim() === "o1")!;
        expect(dropped, "the dropped item is rendered").not.to.equal(undefined);
        const droppedZone = dropped.querySelector("ul")!;
        await vi.waitFor(() =>
            expect(droppedZone.hasAttribute("aria-describedby"), "the dropped item's zone is set up").to.equal(true),
        );
        expect(createdZonesIn(outer), "inner zones set up after the drop").to.equal(3);

        // the dropped item's zone is live: dragging its item starts a drag in it
        await sleep(100);
        const child = droppedZone.firstElementChild as HTMLElement;
        const r = child.getBoundingClientRect();
        const x = r.left + 5;
        const y = r.top + 5;
        child.dispatchEvent(mouse("mousedown", x, y));
        try {
            window.dispatchEvent(mouse("mousemove", x, y + 5));
            await vi.waitFor(() => expect(innerCalls, "the inner drag should start").to.include("consider"));
        } finally {
            window.dispatchEvent(mouse("mouseup", x, y + 5));
        }
        await vi.waitFor(() => expect(innerCalls[innerCalls.length - 1]).to.equal("finalize"), { timeout: 3000 });
    });
});
