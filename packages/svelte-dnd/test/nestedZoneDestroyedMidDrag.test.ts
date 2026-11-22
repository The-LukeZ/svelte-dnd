import { dndzone } from "../src/pointerAction";
import { SHADOW_ITEM_MARKER_PROPERTY_NAME, TRIGGERS } from "../src/constants";
import type { DndEvent, Item } from "../src/types";
import { failOnListenerErrors } from "./helpers/otherWindow";

function mouse(type: string, x: number, y: number): MouseEvent {
    return new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
}

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// regression for #5
describe("a zone nested in the dragged item, destroyed mid-drag", () => {
    failOnListenerErrors();

    it("keeps the drag going and drops the item back into its origin zone", async () => {
        const rootZone = document.createElement("div");
        rootZone.style.position = "fixed";
        rootZone.style.top = "200px";
        rootZone.style.left = "200px";
        rootZone.style.width = "100px";
        const draggedItem = document.createElement("div");
        draggedItem.style.height = "50px";
        const otherItem = document.createElement("div");
        otherItem.style.height = "50px";
        rootZone.append(draggedItem, otherItem);
        document.body.appendChild(rootZone);

        // the dragged item holds a zone of the same type
        const nestedZone = document.createElement("div");
        nestedZone.appendChild(document.createElement("div"));
        draggedItem.appendChild(nestedZone);

        const items: Item[] = [{ id: "dragged" }, { id: "other" }];
        const options = { items, dropAnimationDisabled: true, useCursorForDetection: true };
        const nestedOptions = { items: [{ id: "nested" }], dropAnimationDisabled: true, useCursorForDetection: true };
        // the nested zone is set up first, like Svelte does for a nested action
        const nestedAction = dndzone(nestedZone, nestedOptions);
        const rootAction = dndzone(rootZone, options);

        const nestedConsiders: Item[][] = [];
        nestedZone.addEventListener("consider", (e) => {
            e.stopPropagation();
            nestedConsiders.push((e as CustomEvent<DndEvent>).detail.items);
        });
        rootZone.addEventListener("consider", (e) => {
            const { items, info } = (e as CustomEvent<DndEvent>).detail;
            // model the framework: it removes the dragged item's DOM node once its data entry became the shadow item,
            // and it feeds the new items back into the zone
            if (info.trigger === TRIGGERS.DRAG_STARTED) draggedItem.remove();
            rootAction.update({ ...options, items });
        });
        let finalize: DndEvent | undefined;
        rootZone.addEventListener("finalize", (e) => {
            finalize = (e as CustomEvent<DndEvent>).detail;
        });

        try {
            draggedItem.dispatchEvent(mouse("mousedown", 210, 210));
            window.dispatchEvent(mouse("mousemove", 220, 220));
            // the hidden original element sits at the top left corner, and so does the nested zone inside it
            window.dispatchEvent(mouse("mousemove", 0, 0));
            // the library puts the original element back into the document and starts observing on a later frame
            for (let i = 0; i < 5 && nestedConsiders.length === 0; i++) await nextFrame();
            expect(
                nestedConsiders[nestedConsiders.length - 1]?.some((item) => item[SHADOW_ITEM_MARKER_PROPERTY_NAME]),
            ).to.equal(true);

            // the framework destroys the nested zone while the drag runs
            nestedAction.destroy();
            window.dispatchEvent(mouse("mouseup", 0, 0));

            expect(finalize?.info.trigger).to.equal(TRIGGERS.DROPPED_OUTSIDE_OF_ANY);
            expect(finalize?.items.map((item) => item.id)).to.deep.equal(["dragged", "other"]);
        } finally {
            window.dispatchEvent(mouse("mouseup", 0, 0));
            nestedAction.destroy();
            rootAction.destroy();
            rootZone.remove();
            draggedItem.remove();
        }
    });
});
