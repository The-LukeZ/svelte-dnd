import { render } from "vitest-browser-svelte";
import { SOURCES, TRIGGERS, setDebugMode } from "../../src/constants";
import type { DndEvent } from "../../src/types";
import List from "./fixtures/List.svelte";
import ListWithAttr from "./fixtures/ListWithAttr.svelte";

type Row = { id: number; name: string };
type Call = { kind: "consider" | "finalize"; detail: DndEvent<Row>; run: number };

const INITIAL = () => [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
    { id: 3, name: "c" },
];

const lastOf = <T>(list: T[]): T => list[list.length - 1];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function mouse(type: string, x: number, y: number): MouseEvent {
    return new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
}

function key(target: EventTarget, k: string): void {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

function names(zone: HTMLElement): string[] {
    return Array.from(zone.querySelectorAll("li"), (li) => li.textContent);
}

function names0(detail: DndEvent<Row>): string[] {
    return detail.items.map((item) => item.name);
}

/**
 * Drags the zone's first item below its last item with the mouse and releases it there. Waits for the dragged item to
 * reach the end of the list before releasing, and for the finalize after.
 */
async function dragFirstBelowLast(zone: HTMLElement, calls: { kind: string; detail: DndEvent<Row> }[]): Promise<void> {
    const lis = Array.from(zone.querySelectorAll("li"));
    const first = lis[0].getBoundingClientRect();
    const last = lis[lis.length - 1].getBoundingClientRect();
    const x = first.left + 5;
    const endY = last.bottom - 2;
    lis[0].dispatchEvent(mouse("mousedown", x, first.top + first.height / 2));
    try {
        window.dispatchEvent(mouse("mousemove", x, first.top + first.height / 2 + 5));
        await vi.waitFor(() => expect(calls.length, "the drag should start").to.be.greaterThan(0));
        // a few moves, so the observer sees the dragged element cross each item
        for (let y = first.top + first.height; y <= endY; y += first.height / 2) {
            window.dispatchEvent(mouse("mousemove", x, y));
            await sleep(30);
        }
        window.dispatchEvent(mouse("mousemove", x, endY));
        await vi.waitFor(
            () => {
                const lastConsider = lastOf(calls.filter((call) => call.kind === "consider"));
                expect(names0(lastConsider.detail)).to.deep.equal(["b", "c", "a"]);
            },
            { timeout: 3000 },
        );
    } finally {
        // release even when the drag went wrong, so it does not leak into the next test
        window.dispatchEvent(mouse("mouseup", x, endY));
    }
    await vi.waitFor(() => expect(lastOf(calls).kind).to.equal("finalize"));
}

describe("dndzone attachment", () => {
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

    async function renderList() {
        const calls: Call[] = [];
        const screen = await render(List, {
            initial: INITIAL(),
            onCall: (kind: Call["kind"], detail: DndEvent<Row>, run: number) => calls.push({ kind, detail, run }),
        });
        const zone = screen.getByTestId("zone").element() as HTMLElement;
        return { screen, zone, calls };
    }

    it("keeps a pointer drag going while every consider reassigns items", { timeout: 10000 }, async () => {
        const { zone, calls } = await renderList();
        await dragFirstBelowLast(zone, calls);
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["b", "c", "a"]));
        expect(calls.filter((call) => call.kind === "consider").length).to.be.greaterThan(1);
        expect(lastOf(calls).detail.info.trigger).to.equal(TRIGGERS.DROPPED_INTO_ZONE);
    });

    it("creates the zone once across item updates", { timeout: 10000 }, async () => {
        const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
        setDebugMode(true);
        try {
            const { zone, calls } = await renderList();
            await dragFirstBelowLast(zone, calls);
            const messages = debug.mock.calls.map(([message]) => String(message));
            expect(messages.filter((m) => m.startsWith("dndzone good to go options"))).to.have.length(1);
            expect(messages.filter((m) => m.startsWith("pointer dndzone will update")).length).to.be.greaterThan(1);
        } finally {
            setDebugMode(false);
            debug.mockRestore();
        }
    });

    it("runs a keyboard drag through the attachment", async () => {
        const { zone, calls } = await renderList();
        const a = zone.querySelector("li")!;
        a.focus();
        key(a, " ");
        key(document.activeElement!, "ArrowDown");
        key(document.activeElement!, " ");
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["b", "a", "c"]));
        const finalize = lastOf(calls.filter((call) => call.kind === "finalize"));
        expect(finalize.detail.info.source).to.equal(SOURCES.KEYBOARD);
        expect(names0(finalize.detail)).to.deep.equal(["b", "a", "c"]);
    });

    it("removes the aria instructions when the last zone unmounts mid-drag", async () => {
        const { screen, zone, calls } = await renderList();
        const a = zone.querySelector("li")!;
        a.focus();
        key(a, " ");
        expect(calls.map((call) => call.detail.info.trigger)).to.include(TRIGGERS.DRAG_STARTED);
        expect(document.getElementById("dnd-zone-active"), "instructions while the zone lives").not.to.equal(null);
        await screen.unmount();
        for (const id of ["dnd-zone-active", "dnd-zone-drag-disabled", "dnd-action-aria-alert"]) {
            expect(document.getElementById(id), id).to.equal(null);
        }
    });

    it("updates the zone when items is reassigned", async () => {
        const { screen, zone, calls } = await renderList();
        await screen.getByRole("button", { name: "add" }).click();
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["a", "b", "c", "d"]));
        // the engine set up the new item for keyboard drags only if update ran with the new items
        const d = zone.querySelectorAll("li")[3];
        d.focus();
        key(d, " ");
        key(document.activeElement!, "ArrowUp");
        key(document.activeElement!, " ");
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["a", "b", "d", "c"]));
        const finalize = lastOf(calls.filter((call) => call.kind === "finalize"));
        expect(finalize.detail.info.source).to.equal(SOURCES.KEYBOARD);
        expect(finalize.detail.info.id).to.equal(4);
    });

    it("never fires an onconsider attribute on the zone element", { timeout: 10000 }, async () => {
        const spy = vi.fn();
        const calls: { kind: "consider" | "finalize"; detail: DndEvent<Row> }[] = [];
        const screen = await render(ListWithAttr, {
            initial: INITIAL(),
            spy,
            onCall: (kind: Call["kind"], detail: DndEvent<Row>) => calls.push({ kind, detail }),
        });
        const zone = screen.getByTestId("zone").element() as HTMLElement;
        await dragFirstBelowLast(zone, calls);
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["b", "c", "a"]));
        expect(spy).not.toHaveBeenCalled();
        expect(calls.filter((call) => call.kind === "finalize")).to.have.length(1);
        const triggers = calls.map((call) => call.detail.info.trigger);
        const doubled = triggers.filter(
            (trigger, i) => trigger === TRIGGERS.DRAGGED_ENTERED && triggers[i - 1] === TRIGGERS.DRAGGED_ENTERED,
        );
        expect(doubled, `triggers ${triggers.join(", ")}`).to.deep.equal([]);
        // the attribute does listen: a consider event on the element reaches it
        zone.dispatchEvent(new CustomEvent("consider"));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    // Review Focus 2
    it("calls the latest onfinalize when the getter returns new closures", { timeout: 10000 }, async () => {
        const { zone, calls } = await renderList();
        await dragFirstBelowLast(zone, calls);
        const considers = calls.filter((call) => call.kind === "consider");
        const finalize = lastOf(calls);
        // every consider reassigned items, so the getter ran again after the last one, before the drop
        expect(finalize.run).to.equal(lastOf(considers).run + 1);
        expect(finalize.run).not.to.equal(0);
    });
});
