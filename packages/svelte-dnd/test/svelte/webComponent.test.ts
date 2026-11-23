import { render } from "vitest-browser-svelte";
import { DRAGGED_ELEMENT_ID } from "../../src/constants";
import type { DndEvent, TransformDraggedElementFunction } from "../../src/types";
import WebComponentList from "./fixtures/WebComponentList.svelte";
import { mouse } from "./helpers";

type Row = { id: number; name: string };
type Call = { kind: "consider" | "finalize"; detail: DndEvent<Row> };

const INITIAL = () => [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
];

const lastOf = <T>(list: T[]): T => list[list.length - 1];

type Label = HTMLElement & { label: string };

/** The label the dragged clone's custom element shows in its shadow root */
function draggedLabel(): string | null | undefined {
    return document.querySelector<Label>(`#${DRAGGED_ELEMENT_ID} x-dnd-label`)?.shadowRoot?.textContent;
}

/**
 * Starts a drag on the first item, runs check while the clone is shown, then drops.
 */
async function whileDraggingFirst(zone: HTMLElement, calls: Call[], check: () => Promise<void>): Promise<void> {
    const li = zone.querySelector("li")!;
    const rect = li.getBoundingClientRect();
    const x = rect.left + 5;
    const y = rect.top + rect.height / 2;
    li.dispatchEvent(mouse("mousedown", x, y));
    try {
        window.dispatchEvent(mouse("mousemove", x, y + 5));
        await vi.waitFor(() => expect(calls.length, "the drag should start").to.be.greaterThan(0));
        await check();
    } finally {
        window.dispatchEvent(mouse("mouseup", x, y));
    }
    await vi.waitFor(() => expect(lastOf(calls).kind).to.equal("finalize"));
}

// upstream isaacHagoel/svelte-dnd-action#394: cloneNode copies attributes but not JS properties, so the dragged clone
// of a web component that keeps its state in properties shows its defaults.
describe("dragged clone of a web component", () => {
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

    it("loses the state the component keeps in properties", async () => {
        const calls: Call[] = [];
        const screen = await render(WebComponentList, {
            initial: INITIAL(),
            onCall: (kind: Call["kind"], detail: DndEvent<Row>) => calls.push({ kind, detail }),
        });
        const zone = screen.getByTestId("zone").element() as HTMLElement;
        expect(zone.querySelector<Label>("x-dnd-label")!.shadowRoot!.textContent).to.equal("a");

        await whileDraggingFirst(zone, calls, async () => {
            // a platform limit of cloneNode, which the library cannot undo without knowing the component
            await vi.waitFor(() => expect(draggedLabel()).to.equal("(no label)"));
        });
    });

    it("gets its state back through transformDraggedElement", async () => {
        const calls: Call[] = [];
        // the documented workaround: set the properties again from the item's data
        const transformDraggedElement: TransformDraggedElementFunction<Row> = (element, data) => {
            const label = element?.querySelector<Label>("x-dnd-label");
            if (label && data) label.label = data.name;
        };
        const screen = await render(WebComponentList, {
            initial: INITIAL(),
            transformDraggedElement,
            onCall: (kind: Call["kind"], detail: DndEvent<Row>) => calls.push({ kind, detail }),
        });
        const zone = screen.getByTestId("zone").element() as HTMLElement;

        await whileDraggingFirst(zone, calls, async () => {
            await vi.waitFor(() => expect(draggedLabel()).to.equal("a"));
        });
    });
});
