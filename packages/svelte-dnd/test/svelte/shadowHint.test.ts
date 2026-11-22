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
    async function dragFirstToEnd(hint: boolean) {
        const calls: { kind: string; detail: DndEvent }[] = [];
        const screen = await render(NestedInShadow, {
            hint,
            onCall: (kind: string, detail: DndEvent) => calls.push({ kind, detail }),
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
     * Known limitation, inherited from svelte-dnd-action and to be fixed before 1.0, tracked in
     * https://github.com/The-LukeZ/svelte-dnd/issues/7. With the hint, the zone nested in the shadow item is skipped
     * when it is created, and createZone keeps no way to set it up later. After the drop the shadow item's element stays
     * as the dropped item's element, so the dropped item's nested zone is never set up and stays inert.
     * This test pins the current behavior rather than using `it.fails`, so that a drag that went wrong fails it instead
     * of reading as "limitation still present". When #7 is fixed, flip the last two assertions to 3 set-up zones.
     */
    it(
        "known limitation #7: with the hint, the dropped item's nested zone stays inert",
        { timeout: 10000 },
        async () => {
            const { outer, calls } = await dragFirstToEnd(true);
            // the drop happened
            const finalize = calls[calls.length - 1];
            expect(finalize.kind).to.equal("finalize");
            expect(finalize.detail.info.id, "the dropped item").to.equal("o1");
            await vi.waitFor(() =>
                expect(outer.querySelectorAll('[data-is-dnd-shadow-item-hint="true"]').length).to.equal(0),
            );
            const dropped = Array.from(outer.children).find((li) => li.firstChild!.textContent!.trim() === "o1")!;
            expect(dropped, "the dropped item is rendered").not.to.equal(undefined);
            expect(
                dropped.querySelector("ul")!.hasAttribute("aria-describedby"),
                "the dropped item's zone is not set up (#7)",
            ).to.equal(false);
            expect(createdZonesIn(outer), "inner zones set up after the drop (#7)").to.equal(2);
        },
    );
});
