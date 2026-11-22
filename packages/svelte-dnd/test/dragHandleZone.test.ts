import {
    overrideItemIdKeyNameBeforeInitialisingDndZones,
    SHADOW_ELEMENT_ATTRIBUTE_NAME,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
} from "../src/constants";
import { dragHandle, dragHandleZone } from "../src/wrappers/withDragHandles";
import type { DndEvent, Item } from "../src/types";
import { key } from "./helpers/otherWindow";

describe("dragHandleZone", () => {
    it("destroys its wrapped dndzone", () => {
        const zone = document.createElement("div");
        zone.appendChild(document.createElement("div"));
        document.body.appendChild(zone);

        const action = dragHandleZone(zone, { items: [{ id: 1 }] });
        action.destroy!();

        expect(() => overrideItemIdKeyNameBeforeInitialisingDndZones("id")).not.to.throw();
        zone.remove();
    });

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

        const rootAction = dragHandleZone(rootZone, { items, dropAnimationDisabled: true, onconsider });
        const handleAction = dragHandle(dragHandleEl);
        const nestedAction = dragHandleZone(nestedZone, { items: [{ id: "nested" }], dropAnimationDisabled: true });

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
            rootAction.update!({ items: shadowItems, dropAnimationDisabled: true, onconsider });
            shadowItem.remove();
            nestedAction.destroy!();

            expect(nextItem.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME)).to.equal(false);
            expect(nextItem.style.visibility).to.equal("");
        } finally {
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );
            nestedAction.destroy!();
            rootAction.destroy!();
            handleAction.destroy();
            rootZone.remove();
            nestedZone.remove();
        }
    });

    it("resets the handle state when a handle zone is destroyed mid-drag", () => {
        function createHandleZone(id: string) {
            const zone = document.createElement("div");
            const item = document.createElement("div");
            const handle = document.createElement("div");
            item.appendChild(handle);
            zone.appendChild(item);
            document.body.appendChild(zone);
            const considers: DndEvent[] = [];
            const action = dragHandleZone(zone, { items: [{ id }], onconsider: (e) => considers.push(e) });
            const handleAction = dragHandle(handle);
            return { zone, item, handle, action, handleAction, considers };
        }
        const press = (el: HTMLElement, key: string) =>
            el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        const a = createHandleZone("a");
        const b = createHandleZone("b");
        try {
            a.handle.focus();
            press(a.handle, "Enter");
            expect(b.handle.style.cursor, "a handle drag is in progress").to.equal("grabbing");
            const callsBeforeDestroy = a.considers.length;

            // the framework destroys the zone that holds the drag, which drops the item
            a.action.destroy!();

            expect(a.considers.length, "the destroyed zone gets no calls").to.equal(callsBeforeDestroy);
            expect(b.handle.style.cursor, "the other zone's handle is ready for a new drag").to.equal("grab");
            expect(b.handle.tabIndex).to.equal(0);
            press(b.item, " ");
            expect(b.considers, "the other zone's item is not draggable without its handle").to.deep.equal([]);
        } finally {
            key(window, "Escape");
            [a, b].forEach(({ zone, action, handleAction }) => {
                action.destroy!();
                handleAction.destroy();
                zone.remove();
            });
        }
    });
});
