import { render } from "vitest-browser-svelte";
import {
    SHADOW_ELEMENT_ATTRIBUTE_NAME,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SOURCES,
    TRIGGERS,
    setDebugMode,
} from "../../src/constants";
import { configure } from "../../src/configure";
import { _pendingHandleCount, attachHandle, createHandleZone } from "../../src/wrappers/withDragHandles";
import type { DndEvent, Item } from "../../src/types";
import HandleList from "./fixtures/HandleList.svelte";
import TwoHandleZones from "./fixtures/TwoHandleZones.svelte";
import NestedHandleZones from "./fixtures/NestedHandleZones.svelte";

type Kind = "consider" | "finalize";
type Call = { kind: Kind; detail: DndEvent };
type ZoneCall = Call & { zone: "a" | "b" };

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

function centre(el: Element): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** The item's text without the handle's "::" */
function names(zone: HTMLElement): string[] {
    return Array.from(zone.children, (li) => li.textContent!.replace("::", "").trim());
}

function handlesOf(root: ParentNode, testId: string): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
}

function expectReady(handles: HTMLElement[], label: string): void {
    expect(handles.length, label).to.be.greaterThan(0);
    handles.forEach((handle, i) => {
        expect(handle.tabIndex, `${label} ${i} tabIndex`).to.equal(0);
        expect(handle.style.cursor, `${label} ${i} cursor`).to.equal("grab");
    });
}

function expectDisabled(handles: HTMLElement[], label: string): void {
    expect(handles.length, label).to.be.greaterThan(0);
    handles.forEach((handle, i) => {
        expect(handle.tabIndex, `${label} ${i} tabIndex`).to.equal(-1);
        expect(handle.style.cursor, `${label} ${i} cursor`).to.equal("");
    });
}

/**
 * Presses the mouse on `start`, moves it in steps to `to` and waits for `until` before releasing it there. Always
 * releases, so a drag that went wrong does not leak into the next test.
 */
async function pointerDrag(start: Element, to: { x: number; y: number }, until: () => void): Promise<void> {
    const from = centre(start);
    start.dispatchEvent(mouse("mousedown", from.x, from.y));
    try {
        window.dispatchEvent(mouse("mousemove", from.x, from.y + 5));
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
            window.dispatchEvent(
                mouse("mousemove", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps),
            );
            await sleep(30);
        }
        await vi.waitFor(until, { timeout: 3000 });
    } finally {
        window.dispatchEvent(mouse("mouseup", to.x, to.y));
    }
}

/** Presses the mouse on an item's body, away from its handle, moves it and releases it. */
async function pressBody(item: HTMLElement): Promise<void> {
    const rect = item.getBoundingClientRect();
    const x = rect.right - 3;
    const y = rect.top + rect.height / 2;
    item.dispatchEvent(mouse("mousedown", x, y));
    try {
        window.dispatchEvent(mouse("mousemove", x, y + 10));
        window.dispatchEvent(mouse("mousemove", x, y + 30));
        await sleep(50);
    } finally {
        window.dispatchEvent(mouse("mouseup", x, y + 30));
    }
}

describe("drag handle attachments", () => {
    let errors: string[];
    const onError = (e: ErrorEvent): number => errors.push(e.message);
    beforeEach(() => {
        errors = [];
        window.addEventListener("error", onError);
    });
    afterEach(() => {
        // ends a keyboard drag a failed test left behind
        key(window, "Escape");
        window.removeEventListener("error", onError);
        expect(errors, "errors thrown by listeners").to.deep.equal([]);
    });

    async function renderList() {
        const calls: Call[] = [];
        const screen = await render(HandleList, {
            initial: INITIAL(),
            onCall: (kind: Kind, detail: DndEvent) => calls.push({ kind, detail }),
        });
        const zone = screen.getByTestId("zone").element() as HTMLElement;
        return { screen, zone, calls, handles: () => handlesOf(zone, "handle") };
    }

    async function renderTwoZones() {
        const calls: ZoneCall[] = [];
        const screen = await render(TwoHandleZones, {
            onCall: (zone: "a" | "b", kind: Kind, detail: DndEvent) => calls.push({ zone, kind, detail }),
        });
        const a = screen.getByTestId("zone-a").element() as HTMLElement;
        const b = screen.getByTestId("zone-b").element() as HTMLElement;
        return { screen, a, b, calls };
    }

    it("handles are tabbable right after mount", async () => {
        const { handles } = await renderList();
        expect(handles()).to.have.length(3);
        expectReady(handles(), "handle");
        handles().forEach((handle) => expect(handle.getAttribute("role")).to.equal("button"));
    });

    it("starts a drag only from the handle", { timeout: 10000 }, async () => {
        const { zone, calls, handles } = await renderList();
        await pressBody(zone.children[0] as HTMLElement);
        expect(calls, "pressing the item body starts no drag").to.deep.equal([]);
        expect(names(zone)).to.deep.equal(["a", "b", "c"]);

        const last = zone.children[2].getBoundingClientRect();
        const target = { x: centre(handles()[0]).x, y: last.bottom - 2 };
        await pointerDrag(handles()[0], target, () => {
            const considers = calls.filter((call) => call.kind === "consider");
            expect(considers.length, "the drag should start").to.be.greaterThan(0);
            expect(lastOf(considers).detail.items.map((item) => item.name)).to.deep.equal(["b", "c", "a"]);
        });
        await vi.waitFor(() => expect(lastOf(calls).kind).to.equal("finalize"));
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["b", "c", "a"]));
        expectReady(handles(), "handle after the drop");
    });

    it("starts a keyboard drag from the handle with the trigger key", async () => {
        const { zone, calls, handles } = await renderList();
        const handle = handles()[0];
        handle.focus();
        key(handle, "Enter");
        expect(calls.map((call) => call.detail.info.trigger)).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        expect(document.activeElement).to.equal(zone.children[0]);
        key(document.activeElement!, "ArrowDown");
        key(document.activeElement!, "Enter");
        await vi.waitFor(() => expect(names(zone)).to.deep.equal(["b", "a", "c"]));
        const finalize = lastOf(calls.filter((call) => call.kind === "finalize"));
        expect(finalize.detail.info.source).to.equal(SOURCES.KEYBOARD);
        expect(lastOf(calls).detail.info.trigger).to.equal(TRIGGERS.DRAG_STOPPED);
        expectReady(handles(), "handle after the drop");
    });

    it("dragDisabled toggles the handles", async () => {
        const { screen, handles } = await renderList();
        await screen.getByRole("button", { name: "toggle" }).click();
        await vi.waitFor(() => expectDisabled(handles(), "disabled handle"));
        await screen.getByRole("button", { name: "toggle" }).click();
        await vi.waitFor(() => expectReady(handles(), "enabled handle"));
    });

    it("one zone's dragDisabled does not affect another zone's handles", async () => {
        const { screen, a, b } = await renderTwoZones();
        expectReady(handlesOf(a, "handle-a"), "A");
        expectReady(handlesOf(b, "handle-b"), "B");
        await screen.getByRole("button", { name: "toggle a" }).click();
        await vi.waitFor(() => expectDisabled(handlesOf(a, "handle-a"), "A"));
        expectReady(handlesOf(b, "handle-b"), "B");
        await screen.getByRole("button", { name: "toggle a" }).click();
        await screen.getByRole("button", { name: "toggle b" }).click();
        await vi.waitFor(() => expectDisabled(handlesOf(b, "handle-b"), "B"));
        expectReady(handlesOf(a, "handle-a"), "A");
    });

    it("a handle in a dragDisabled zone does not unlock another zone", { timeout: 10000 }, async () => {
        const { screen, a, b, calls } = await renderTwoZones();
        await screen.getByRole("button", { name: "toggle a" }).click();
        await vi.waitFor(() => expectDisabled(handlesOf(a, "handle-a"), "A"));
        const handle = handlesOf(a, "handle-a")[0];
        const from = centre(handle);

        // pointer: B stays locked while the press on A's handle is held
        handle.dispatchEvent(mouse("mousedown", from.x, from.y));
        try {
            expectReady(handlesOf(b, "handle-b"), "B while A's handle is pressed");
            expectDisabled(handlesOf(a, "handle-a"), "A while its handle is pressed");
        } finally {
            window.dispatchEvent(mouse("mouseup", from.x, from.y));
        }

        // keyboard: the trigger key on A's handle has no release that would reset the shared state
        handle.focus();
        key(handle, " ");
        key(handle, "Enter");
        expectReady(handlesOf(b, "handle-b"), "B after the trigger keys on A's handle");
        expectDisabled(handlesOf(a, "handle-a"), "A after the trigger keys on its handle");

        const before = calls.length;
        for (const item of [...b.children] as HTMLElement[]) {
            await pressBody(item);
        }
        expect(calls.slice(before), "B's items are not draggable without a handle press").to.deep.equal([]);
    });

    async function expectBothLocked(a: HTMLElement, b: HTMLElement, calls: ZoneCall[]): Promise<void> {
        expectReady([...a.querySelectorAll<HTMLElement>("[data-testid^=handle]")], "A");
        expectReady([...b.querySelectorAll<HTMLElement>("[data-testid^=handle]")], "B");
        const before = calls.length;
        for (const item of [...a.children, ...b.children] as HTMLElement[]) {
            item.focus();
            key(item, " ");
            await pressBody(item);
        }
        expect(calls.slice(before), "items are not draggable without a handle press").to.deep.equal([]);
    }

    it("a keyboard drag from zone A drops into zone B and leaves both disabled", async () => {
        const { a, b, calls } = await renderTwoZones();
        const handle = handlesOf(a, "handle-a")[0];
        handle.focus();
        key(handle, "Enter");
        expect(calls.map((call) => call.detail.info.trigger)).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        b.focus();
        await vi.waitFor(() => {
            expect(names(b)).to.include("a1");
            expect(b.contains(document.activeElement), "the moved item is focused in B").to.equal(true);
        });
        key(document.activeElement!, "Enter");
        await vi.waitFor(() => {
            const last = lastOf(calls);
            expect(last.zone).to.equal("b");
            expect(last.detail.info.trigger).to.equal(TRIGGERS.DRAG_STOPPED);
        });
        expect(names(a)).to.deep.equal(["a2"]);
        expect(names(b)).to.include("a1");
        await expectBothLocked(a, b, calls);
    });

    it("a pointer drag from zone A drops into zone B and leaves both disabled", { timeout: 10000 }, async () => {
        const { a, b, calls } = await renderTwoZones();
        const handle = handlesOf(a, "handle-a")[0];
        await pointerDrag(handle, centre(b), () =>
            expect(
                calls.some((call) => call.zone === "b" && call.detail.info.trigger === TRIGGERS.DRAGGED_ENTERED),
                "the item enters B",
            ).to.equal(true),
        );
        await vi.waitFor(() => {
            expect(calls.some((call) => call.zone === "b" && call.kind === "finalize")).to.equal(true);
            expect(calls.some((call) => call.zone === "a" && call.kind === "finalize")).to.equal(true);
        });
        await vi.waitFor(() => {
            expect(names(a)).to.deep.equal(["a2"]);
            expect(names(b)).to.include("a1");
        });
        await expectBothLocked(a, b, calls);
    });

    async function expectNestedScoping(screen: Awaited<ReturnType<typeof render>>): Promise<void> {
        const outer = () => handlesOf(document, "outer-handle");
        const inner = () => handlesOf(document, "inner-handle");
        expect(outer()).to.have.length(2);
        expect(inner()).to.have.length(2);
        expectReady(outer(), "outer");
        expectReady(inner(), "inner");

        await screen.getByRole("button", { name: "toggle inner" }).click();
        await vi.waitFor(() => expectDisabled(inner(), "inner"));
        expectReady(outer(), "outer");

        await screen.getByRole("button", { name: "toggle inner" }).click();
        await screen.getByRole("button", { name: "toggle outer" }).click();
        await vi.waitFor(() => expectDisabled(outer(), "outer"));
        expectReady(inner(), "inner");
    }

    it("nested handle zones scope dragDisabled to the inner zone", async () => {
        await expectNestedScoping(await render(NestedHandleZones));
    });

    it("a nested handle zone mounted after its outer zone scopes dragDisabled to itself", async () => {
        const screen = await render(NestedHandleZones, { innerAtMount: false });
        expect(handlesOf(document, "inner-handle")).to.have.length(0);
        await screen.getByRole("button", { name: "show inner" }).click();
        await vi.waitFor(() => expect(handlesOf(document, "inner-handle")).to.have.length(2));
        await expectNestedScoping(screen);
    });

    // Review Focus 4
    it("handles of items added after mount are tabbable", async () => {
        const { screen, handles } = await renderList();
        await screen.getByRole("button", { name: "add" }).click();
        await vi.waitFor(() => expect(handles()).to.have.length(4));
        expectReady(handles(), "handle");
    });
});

describe("attachHandle and createHandleZone", () => {
    const cleanups: (() => void)[] = [];
    afterEach(() =>
        cleanups
            .splice(0)
            .reverse()
            .forEach((cleanup) => cleanup()),
    );

    function zoneWithItem(items: Item[] = [{ id: 1 }]) {
        const zone = document.createElement("div");
        const item = document.createElement("div");
        const handle = document.createElement("div");
        item.appendChild(handle);
        zone.appendChild(item);
        document.body.appendChild(zone);
        cleanups.push(() => zone.remove());
        return { zone, item, handle, items };
    }

    // Review Focus 4
    it("a handle destroyed before its zone exists leaves no pending entry", () => {
        const handle = document.createElement("div");
        const before = _pendingHandleCount();
        const cleanup = attachHandle(handle);
        expect(_pendingHandleCount(), "no zone yet, so the handle waits").to.equal(before + 1);
        cleanup();
        expect(_pendingHandleCount()).to.equal(before);

        const zone = document.createElement("div");
        const item = document.createElement("div");
        item.appendChild(handle);
        zone.appendChild(item);
        document.body.appendChild(zone);
        const action = createHandleZone(zone, { items: [{ id: 1 }] });
        cleanups.push(() => {
            action.destroy();
            zone.remove();
        });
        expect(handle.tabIndex, "the zone does not adopt a destroyed handle").to.equal(-1);
        expect(handle.hasAttribute("role")).to.equal(false);
    });

    it("a pending handle is adopted by its own zone, not by an unrelated one", () => {
        const before = _pendingHandleCount();
        const mine = zoneWithItem();
        const cleanup = attachHandle(mine.handle);
        cleanups.push(cleanup);
        const other = zoneWithItem();
        const otherAction = createHandleZone(other.zone, { items: [{ id: 2 }] });
        cleanups.push(() => otherAction.destroy());
        expect(_pendingHandleCount(), "an unrelated zone leaves the handle pending").to.equal(before + 1);
        expect(mine.handle.tabIndex).to.equal(-1);

        const action = createHandleZone(mine.zone, { items: [{ id: 1 }] });
        cleanups.push(() => action.destroy());
        expect(_pendingHandleCount()).to.equal(before);
        expect(mine.handle.tabIndex).to.equal(0);
        expect(mine.handle.style.cursor).to.equal("grab");
    });

    it("moves its handles back to pending when destroyed", () => {
        const before = _pendingHandleCount();
        const { zone, handle } = zoneWithItem();
        const action = createHandleZone(zone, { items: [{ id: 1 }] });
        const cleanup = attachHandle(handle);
        cleanups.push(cleanup);
        expect(_pendingHandleCount(), "a handle of a live zone is bound").to.equal(before);

        action.destroy();
        expect(_pendingHandleCount(), "the destroyed zone hands the handle back").to.equal(before + 1);
    });

    it("a new handle zone on the same element adopts the handles", () => {
        const before = _pendingHandleCount();
        const { zone, handle } = zoneWithItem();
        const first = createHandleZone(zone, { items: [{ id: 1 }] });
        cleanups.push(attachHandle(handle));
        first.destroy();

        const considers: DndEvent[] = [];
        const second = createHandleZone(zone, {
            items: [{ id: 1 }],
            dropAnimationDisabled: true,
            onconsider: (e) => considers.push(e),
        });
        cleanups.push(() => second.destroy());
        expect(_pendingHandleCount(), "the new zone adopts the handle").to.equal(before);
        expect(handle.tabIndex).to.equal(0);

        try {
            handle.dispatchEvent(mouse("mousedown", 5, 5));
            window.dispatchEvent(mouse("mousemove", 5, 10));
            window.dispatchEvent(mouse("mousemove", 5, 30));
            expect(considers.map((e) => e.info.trigger)).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        } finally {
            window.dispatchEvent(mouse("mouseup", 5, 30));
        }

        second.update({ items: [{ id: 1 }], dragDisabled: true });
        expect(handle.tabIndex, "the handle follows the new zone's dragDisabled").to.equal(-1);
    });

    it("a handle with no handle zone does nothing", () => {
        const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
        setDebugMode(true);
        try {
            const handle = document.createElement("div");
            document.body.appendChild(handle);
            cleanups.push(() => handle.remove());
            let cleanup!: () => void;
            expect(() => (cleanup = attachHandle(handle))).not.to.throw();
            expect(handle.tabIndex).to.equal(-1);
            handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            key(handle, "Enter");
            expect(handle.style.cursor).to.equal("");
            cleanup();
            const messages = debug.mock.calls.map(([message]) => String(message));
            expect(messages.filter((m) => m.includes("found no dragHandleZone"))).to.have.length(1);
        } finally {
            setDebugMode(false);
            debug.mockRestore();
        }
    });

    // ported from dragHandleZone.test.ts
    it("destroys its wrapped dndzone", () => {
        const zone = document.createElement("div");
        zone.appendChild(document.createElement("div"));
        document.body.appendChild(zone);

        const action = createHandleZone(zone, { items: [{ id: 1 }] });
        action.destroy();

        expect(() => configure({ idKey: "id" })).not.to.throw();
        zone.remove();
    });

    // ported from dragHandleZone.test.ts
    it("does not apply a stale shadow index when a nested zone is destroyed during a drag", () => {
        const rootZone = document.createElement("div");
        const draggedItem = document.createElement("div");
        const dragHandleEl = document.createElement("div");
        const nextItem = document.createElement("div");
        const lastItem = document.createElement("div");
        draggedItem.appendChild(dragHandleEl);
        rootZone.appendChild(draggedItem);
        rootZone.appendChild(nextItem);
        rootZone.appendChild(lastItem);
        document.body.appendChild(rootZone);

        const nestedZone = document.createElement("div");
        nestedZone.appendChild(document.createElement("div"));
        document.body.appendChild(nestedZone);

        const items: Item[] = [{ id: "dragged" }, { id: "next" }, { id: "last" }];
        // assigned by the consider callback before the first read
        let shadowItems!: Item[];
        const onconsider = (e: DndEvent) => {
            shadowItems = e.items;
        };

        const rootAction = createHandleZone(rootZone, { items, dropAnimationDisabled: true, onconsider });
        const handleCleanup = attachHandle(dragHandleEl);
        const nestedAction = createHandleZone(nestedZone, { items: [{ id: "nested" }], dropAnimationDisabled: true });

        try {
            dragHandleEl.dispatchEvent(
                new MouseEvent("mousedown", { button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true }),
            );
            window.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );

            expect(shadowItems.find((item) => item[SHADOW_ITEM_MARKER_PROPERTY_NAME])).not.to.equal(undefined);

            // Model Svelte having removed the shadow DOM node while the action wrapper
            // still holds the previous options. Destroying an unrelated nested wrapper
            // must not broadcast a stale update to the root zone.
            const shadowItem = document.createElement("div");
            rootZone.replaceChild(shadowItem, draggedItem);
            rootAction.update({ items: shadowItems, dropAnimationDisabled: true, onconsider });
            shadowItem.remove();
            nestedAction.destroy();

            expect(nextItem.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME)).to.equal(false);
            expect(nextItem.style.visibility).to.equal("");
        } finally {
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );
            nestedAction.destroy();
            rootAction.destroy();
            handleCleanup();
            rootZone.remove();
            nestedZone.remove();
        }
    });

    // ported from dragHandleZone.test.ts (ruling R2: the handle bookkeeping runs for a zone destroyed mid-drag)
    it("resets the handle state when a handle zone is destroyed mid-drag", () => {
        function makeHandleZone(id: string) {
            const zone = document.createElement("div");
            const item = document.createElement("div");
            const handle = document.createElement("div");
            item.appendChild(handle);
            zone.appendChild(item);
            document.body.appendChild(zone);
            const considers: DndEvent[] = [];
            const action = createHandleZone(zone, { items: [{ id }], onconsider: (e) => considers.push(e) });
            const handleCleanup = attachHandle(handle);
            return { zone, item, handle, action, handleCleanup, considers };
        }
        const a = makeHandleZone("a");
        const b = makeHandleZone("b");
        try {
            a.handle.focus();
            key(a.handle, "Enter");
            expect(b.handle.style.cursor, "a handle drag is in progress").to.equal("grabbing");
            const callsBeforeDestroy = a.considers.length;

            // the framework destroys the zone that holds the drag, which drops the item
            a.action.destroy();

            expect(a.considers.length, "the destroyed zone gets no calls").to.equal(callsBeforeDestroy);
            expect(b.handle.style.cursor, "the other zone's handle is ready for a new drag").to.equal("grab");
            expect(b.handle.tabIndex).to.equal(0);
            key(b.item, " ");
            expect(b.considers, "the other zone's item is not draggable without its handle").to.deep.equal([]);
        } finally {
            key(window, "Escape");
            [a, b].forEach(({ zone, action, handleCleanup }) => {
                action.destroy();
                handleCleanup();
                zone.remove();
            });
        }
    });
});
