import { render } from "vitest-browser-svelte";
import { SHADOW_ELEMENT_ATTRIBUTE_NAME } from "../../src/constants";
import type { DndEvent } from "../../src/types";
import TransitionList from "./fixtures/TransitionList.svelte";
import { mouse } from "./helpers";

type Row = { id: number; name: string };
type Call = { kind: "consider" | "finalize"; detail: DndEvent<Row> };

const INITIAL = () => [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
    { id: 3, name: "c" },
    { id: 4, name: "d" },
];

const OUT_MS = 300;

const lastOf = <T>(list: T[]): T => list[list.length - 1];
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function names(zone: HTMLElement): string[] {
    return Array.from(zone.children, (li) => li.textContent!);
}

function hidden(zone: HTMLElement): string[] {
    return Array.from(zone.children as HTMLCollectionOf<HTMLElement>)
        .filter((li) => li.style.visibility === "hidden" || li.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME))
        .map((li) => li.textContent!);
}

async function renderList(onlyOnRemove: boolean) {
    const calls: Call[] = [];
    const screen = await render(TransitionList, {
        initial: INITIAL(),
        outMs: OUT_MS,
        onlyOnRemove,
        onCall: (kind: Call["kind"], detail: DndEvent<Row>) => calls.push({ kind, detail }),
    });
    return { screen, calls, zone: screen.getByTestId("zone").element() as HTMLElement };
}

/**
 * Drags the first item below the last one and drops it there. Checks after each move that the zone renders one
 * element per item, and after the drop that the item moved and no item stays hidden.
 * The zone can shift once the drag starts, so each move is placed from the zone's current position.
 */
async function dragFirstBelowLast(zone: HTMLElement, calls: Call[]): Promise<void> {
    const count = INITIAL().length;
    const yAt = (fraction: number): number => {
        const rect = zone.getBoundingClientRect();
        return rect.top + rect.height * fraction;
    };
    const x = zone.getBoundingClientRect().left + 5;
    const extraChildren: string[] = [];
    const li = zone.children[0] as HTMLElement;
    li.dispatchEvent(mouse("mousedown", x, yAt(0.5 / count)));
    try {
        window.dispatchEvent(mouse("mousemove", x, yAt(0.5 / count) + 5));
        await vi.waitFor(() => expect(calls.length, "the drag should start").to.be.greaterThan(0));
        for (let step = 2; step <= 2 * count; step++) {
            window.dispatchEvent(mouse("mousemove", x, yAt(step / (2 * count)) - 2));
            await sleep(30);
            // the zone's children must match its items: an element kept for its outro breaks that
            if (zone.children.length !== count) extraChildren.push(names(zone).join());
        }
        await sleep(100);
    } finally {
        // released whatever happened, and the drop awaited, so a broken drag does not leak into the next test
        window.dispatchEvent(mouse("mouseup", x, yAt(1) - 2));
        await vi.waitFor(() => expect(lastOf(calls).kind).to.equal("finalize"));
        await sleep(OUT_MS + 100);
    }
    expect(extraChildren, "zone children that are not items during the drag").to.deep.equal([]);
    expect(lastOf(calls).detail.items.map((item) => item.name)).to.deep.equal(["b", "c", "d", "a"]);
    expect(hidden(zone), "hidden items after the drop").to.deep.equal([]);
    expect(names(zone)).to.deep.equal(["b", "c", "d", "a"]);
}

// upstream isaacHagoel/svelte-dnd-action#96: a drag removes the dragged item from the items and adds a shadow item.
// With an out transition, Svelte keeps the removed element in the zone until the outro ends, so the zone has one
// child more than items, and the engine indexes and styles the wrong children.
describe("items with an out transition", () => {
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

    // a known limit: remove .fails once the engine skips elements that are leaving
    it.fails("breaks a drag when the outro plays on every removal", async () => {
        const { zone, calls } = await renderList(false);
        await dragFirstBelowLast(zone, calls);
    });

    it("works when the outro plays only for items the user removes", async () => {
        const { screen, zone, calls } = await renderList(true);
        await dragFirstBelowLast(zone, calls);

        // the outro still plays for a removal
        (screen.getByTestId("remove-first").element() as HTMLElement).click();
        await vi.waitFor(() => expect(zone.children[0].hasAttribute("inert"), "outro started").to.equal(true));
        expect(names(zone)).to.deep.equal(["b", "c", "d", "a"]);
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["c", "d", "a"]), { timeout: OUT_MS + 1000 });
    });
});
