import { createZone as fullDndzone } from "../src/action";
import { TRIGGERS } from "../src/constants";
import { attachHandle, createHandleZone } from "../src/wrappers/withDragHandles";
import type { DndEvent, Item, Options } from "../src/types";

// Upstream issue isaacHagoel/svelte-dnd-action#511: a zone whose items can be dragged with the pointer only.
describe("keyboardDragDisabled", () => {
    const cleanups: (() => void)[] = [];

    function createZone(items: Item[], options: Partial<Options> = {}) {
        const zone = document.createElement("div");
        items.forEach(() => {
            const child = document.createElement("div");
            child.style.height = "20px";
            zone.appendChild(child);
        });
        document.body.appendChild(zone);
        const considers: DndEvent[] = [];
        const finalizes: DndEvent[] = [];
        const onconsider = (e: DndEvent) => considers.push(e);
        const onfinalize = (e: DndEvent) => finalizes.push(e);
        const action = fullDndzone(zone, { items, onconsider, onfinalize, ...options });
        cleanups.push(() => {
            action.destroy();
            zone.remove();
        });
        return { zone, action, considers, finalizes, children: Array.from(zone.children) as HTMLElement[] };
    }

    function press(el: EventTarget, key: string) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        el.dispatchEvent(event);
        return event;
    }

    afterEach(() => {
        // ends a keyboard drag a failing test left behind
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        cleanups
            .splice(0)
            .reverse()
            .forEach((cleanup) => cleanup());
    });

    it("keeps keyboard dragging on by default", () => {
        const {
            considers,
            children: [item],
        } = createZone([{ id: "a" }, { id: "b" }]);
        item.focus();
        press(item, "Enter");
        expect(considers.map((e) => e.info.trigger)).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        press(item, "Enter");
    });

    it("leaves Space and Enter untouched on the items", () => {
        const {
            considers,
            children: [item],
        } = createZone([{ id: "a" }, { id: "b" }], { keyboardDragDisabled: true });
        item.focus();
        const enter = press(item, "Enter");
        const space = press(item, " ");
        expect(considers).to.deep.equal([]);
        expect(enter.defaultPrevented).to.equal(false);
        expect(space.defaultPrevented).to.equal(false);
    });

    it("leaves the arrow keys untouched", () => {
        const {
            finalizes,
            children: [item],
        } = createZone([{ id: "a" }, { id: "b" }], { keyboardDragDisabled: true });
        item.focus();
        press(item, "Enter");
        const arrow = press(item, "ArrowDown");
        expect(finalizes).to.deep.equal([]);
        expect(arrow.defaultPrevented).to.equal(false);
    });

    it("keeps pointer dragging", () => {
        const {
            considers,
            children: [item],
        } = createZone([{ id: "a" }, { id: "b" }], { keyboardDragDisabled: true, dropAnimationDisabled: true });
        item.dispatchEvent(
            new MouseEvent("mousedown", { button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true }),
        );
        window.dispatchEvent(
            new MouseEvent("mousemove", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
        );
        window.dispatchEvent(new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }));
        expect(considers[0]?.info.trigger).to.equal(TRIGGERS.DRAG_STARTED);
        expect(considers[0]?.info.source).to.equal("pointer");
    });

    it("can be turned on and off through an update", () => {
        const items = [{ id: "a" }, { id: "b" }];
        const {
            action,
            considers,
            children: [item],
        } = createZone(items, { keyboardDragDisabled: true });
        action.update({ items, onconsider: (e) => considers.push(e), keyboardDragDisabled: false });
        item.focus();
        press(item, "Enter");
        expect(considers.map((e) => e.info.trigger)).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        press(item, "Enter");
        considers.length = 0;
        action.update({ items, onconsider: (e) => considers.push(e), keyboardDragDisabled: true });
        item.focus();
        press(item, "Enter");
        expect(considers).to.deep.equal([]);
    });

    it("does not take an item that a keyboard drag tabs into it", () => {
        const source = createZone([{ id: "a" }, { id: "b" }]);
        const target = createZone([{ id: "c" }], { keyboardDragDisabled: true });
        source.children[0].focus();
        press(source.children[0], "Enter");
        expect(target.zone.tabIndex, "not a tab stop for the drag").to.equal(-1);
        target.zone.focus();
        expect(source.finalizes).to.deep.equal([]);
        expect(target.finalizes).to.deep.equal([]);
    });

    it("describes the zone to screen readers as one they cannot drag in", () => {
        const enabled = createZone([{ id: "a" }]);
        const disabled = createZone([{ id: "b" }], { dragDisabled: true });
        const keyboardOff = createZone([{ id: "c" }], { keyboardDragDisabled: true });
        expect(keyboardOff.zone.getAttribute("aria-describedby")).to.equal(
            disabled.zone.getAttribute("aria-describedby"),
        );
        expect(keyboardOff.zone.getAttribute("aria-describedby")).not.to.equal(
            enabled.zone.getAttribute("aria-describedby"),
        );
    });

    it("throws when it is not a boolean", () => {
        const zone = document.createElement("div");
        document.body.appendChild(zone);
        cleanups.push(() => zone.remove());
        expect(() => fullDndzone(zone, { items: [], keyboardDragDisabled: "yes" as unknown as boolean })).to.throw(
            /keyboardDragDisabled/,
        );
    });

    describe("in a dragHandleZone", () => {
        function makeHandleZone(options: Partial<Options> = {}) {
            const zone = document.createElement("div");
            const item = document.createElement("div");
            const handle = document.createElement("div");
            item.appendChild(handle);
            zone.appendChild(item);
            document.body.appendChild(zone);
            const considers: DndEvent[] = [];
            const zoneAction = createHandleZone(zone, {
                items: [{ id: "a" }],
                onconsider: (e) => considers.push(e),
                ...options,
            });
            const handleCleanup = attachHandle(handle);
            cleanups.push(() => {
                handleCleanup();
                zoneAction.destroy();
                zone.remove();
            });
            return { zone, item, handle, considers };
        }

        it("takes the handles out of the tab order and ignores the trigger keys on them", () => {
            const { handle, considers } = makeHandleZone({ keyboardDragDisabled: true });
            expect(handle.tabIndex).to.equal(-1);
            const enter = press(handle, "Enter");
            expect(enter.defaultPrevented).to.equal(false);
            expect(considers).to.deep.equal([]);
            expect(handle.style.cursor, "the handle keeps its pointer cursor").to.equal("grab");
        });

        it("keeps the handles keyboard draggable by default", () => {
            const { handle, considers } = makeHandleZone();
            expect(handle.tabIndex).to.equal(0);
            press(handle, "Enter");
            expect(considers.map((e) => e.info.trigger)).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            press(handle, "Enter");
        });
    });
});
