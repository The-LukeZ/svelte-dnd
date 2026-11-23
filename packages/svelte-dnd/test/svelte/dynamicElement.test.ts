import { render } from "vitest-browser-svelte";
import { SHADOW_ELEMENT_ATTRIBUTE_NAME } from "../../src/constants";
import type { DndEvent } from "../../src/types";
import DynamicElementList from "./fixtures/DynamicElementList.svelte";
import { mouse } from "./helpers";

type Row = { id: number; name: string };
type Call = { kind: "consider" | "finalize"; detail: DndEvent<Row> };

const INITIAL = () => [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
    { id: 3, name: "c" },
    { id: 4, name: "d" },
];

const lastOf = <T>(list: T[]): T => list[list.length - 1];
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** The item's name, without the handle's "::" */
function text(li: Element): string {
    return li.textContent!.replace("::", "").trim();
}

/** The items the zone hides: only the shadow item, and only during a drag. */
function hidden(zone: HTMLElement): string[] {
    return Array.from(zone.children as HTMLCollectionOf<HTMLElement>)
        .filter((li) => li.style.visibility === "hidden" || li.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME))
        .map((li) => text(li));
}

// upstream isaacHagoel/svelte-dnd-action#640: with the zone on a <svelte:element>, items the pointer passed over
// stayed hidden, during the drag and after the drop.
describe.each([
    { flipDurationMs: 0, handles: false, label: "dndzone, no flip" },
    { flipDurationMs: 100, handles: false, label: "dndzone, flip" },
    { flipDurationMs: 0, handles: true, label: "dragHandleZone, no flip" },
    { flipDurationMs: 100, handles: true, label: "dragHandleZone, flip" },
])("zone on a <svelte:element> ($label)", ({ flipDurationMs, handles }) => {
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

    it("hides only the shadow item during the drag and no item after the drop", async () => {
        const calls: Call[] = [];
        const screen = await render(DynamicElementList, {
            initial: INITIAL(),
            tag: "ul",
            flipDurationMs,
            handles,
            onCall: (kind: Call["kind"], detail: DndEvent<Row>) => calls.push({ kind, detail }),
        });
        const zone = screen.getByTestId("zone").element() as HTMLElement;
        const lis = Array.from(zone.children) as HTMLElement[];
        const first = lis[0].getBoundingClientRect();
        const last = lis[lis.length - 1].getBoundingClientRect();
        const x = first.left + 5;
        const endY = last.bottom - 2;
        const grabbed = handles ? lis[0].querySelector<HTMLElement>('[data-testid="handle"]')! : lis[0];
        grabbed.dispatchEvent(mouse("mousedown", x, first.top + first.height / 2));
        try {
            window.dispatchEvent(mouse("mousemove", x, first.top + first.height / 2 + 5));
            await vi.waitFor(() => expect(calls.length, "the drag should start").to.be.greaterThan(0));
            for (let y = first.top + first.height; y <= endY; y += first.height / 2) {
                window.dispatchEvent(mouse("mousemove", x, y));
                await sleep(flipDurationMs + 30);
                // the shadow item is the one item the zone may hide
                expect(hidden(zone).length, `hidden items at y=${y}: ${hidden(zone)}`).to.be.at.most(1);
            }
            window.dispatchEvent(mouse("mousemove", x, endY));
            await vi.waitFor(
                () => {
                    const lastConsider = lastOf(calls.filter((call) => call.kind === "consider"));
                    expect(lastConsider.detail.items.map((item) => item.name)).to.deep.equal(["b", "c", "d", "a"]);
                },
                { timeout: 3000 },
            );
            await sleep(flipDurationMs + 30);
            expect(hidden(zone), "hidden items during the drag").to.deep.equal(["a"]);
        } finally {
            window.dispatchEvent(mouse("mouseup", x, endY));
        }
        await vi.waitFor(() => expect(lastOf(calls).kind).to.equal("finalize"));
        await vi.waitFor(() => expect(hidden(zone), "hidden items after the drop").to.deep.equal([]), {
            timeout: 3000,
        });
        expect(Array.from(zone.children, text)).to.deep.equal(["b", "c", "d", "a"]);
    });
});
