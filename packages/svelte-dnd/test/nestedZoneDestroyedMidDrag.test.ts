import { dndzone } from "../src/pointerAction";
import { SHADOW_ITEM_MARKER_PROPERTY_NAME, TRIGGERS } from "../src/constants";
import type { DndEvent, Item } from "../src/types";
import { failOnListenerErrors } from "./helpers/otherWindow";

function mouse(type: string, x: number, y: number): MouseEvent {
    return new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
}

function moveTo(x: number, y: number): void {
    window.dispatchEvent(mouse("mousemove", x, y));
}

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitFor(condition: () => boolean, what: string): Promise<void> {
    for (let i = 0; i < 30 && !condition(); i++) await nextFrame();
    expect(condition(), what).to.equal(true);
}

const hasShadow = (items: Item[] | undefined): boolean =>
    !!items?.some((item) => item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);

// The origin zone sits at 200,200 and is 100px wide, its items are 50px high.
const OVER_ORIGIN = { x: 220, y: 220 };
const OUTSIDE_OF_ANY = { x: 600, y: 600 };

// waits for the observer to have run a few times, as it does not report back when nothing changes
async function letTheObserverRun(): Promise<void> {
    for (let i = 0; i < 10; i++) await nextFrame();
}

function setUp({ draggedIndex, dropAnimationDisabled }: { draggedIndex: number; dropAnimationDisabled: boolean }) {
    const rootZone = document.createElement("div");
    rootZone.style.position = "fixed";
    rootZone.style.top = "200px";
    rootZone.style.left = "200px";
    rootZone.style.width = "100px";
    const ids = draggedIndex === 0 ? ["dragged", "other"] : ["other", "dragged"];
    const elements = ids.map(() => {
        const el = document.createElement("div");
        el.style.height = "50px";
        return el;
    });
    rootZone.append(...elements);
    document.body.appendChild(rootZone);
    const draggedItem = elements[draggedIndex];

    // the dragged item holds a zone of the same type
    const nestedZone = document.createElement("div");
    nestedZone.appendChild(document.createElement("div"));
    draggedItem.appendChild(nestedZone);

    const options = { items: ids.map((id): Item => ({ id })), dropAnimationDisabled, useCursorForDetection: true };
    // the nested zone is set up first, like Svelte does for a nested action
    const nestedAction = dndzone(nestedZone, { ...options, items: [{ id: "nested" }] });
    const rootAction = dndzone(rootZone, options);

    const nestedConsiders: Item[][] = [];
    nestedZone.addEventListener("consider", (e) => {
        e.stopPropagation();
        nestedConsiders.push((e as CustomEvent<DndEvent>).detail.items);
    });
    const rootConsiders: Item[][] = [];
    rootZone.addEventListener("consider", (e) => {
        const { items, info } = (e as CustomEvent<DndEvent>).detail;
        rootConsiders.push(items);
        // model the framework: it removes the dragged item's DOM node once its data entry became the shadow item,
        // and it feeds the new items back into the zone
        if (info.trigger === TRIGGERS.DRAG_STARTED) draggedItem.remove();
        rootAction.update({ ...options, items });
    });
    const finalizes: DndEvent[] = [];
    rootZone.addEventListener("finalize", (e) => {
        finalizes.push((e as CustomEvent<DndEvent>).detail);
    });

    function startDrag(): void {
        const rect = draggedItem.getBoundingClientRect();
        draggedItem.dispatchEvent(mouse("mousedown", rect.left + 10, rect.top + 10));
        moveTo(rect.left + 20, rect.top + 20);
    }
    // The library keeps the original element in the document, hidden, and the nested zone inside it stays watched.
    // Its rect is where the observer looks for it, so the pointer goes there.
    async function moveOverNested(): Promise<void> {
        await waitFor(() => draggedItem.isConnected && draggedItem.style.display === "none", "original element hidden");
        const rect = nestedZone.getBoundingClientRect();
        moveTo(rect.left, rect.top);
    }
    function cleanUp(): void {
        window.dispatchEvent(mouse("mouseup", 0, 0));
        nestedAction.destroy();
        rootAction.destroy();
        rootZone.remove();
        draggedItem.remove();
    }
    return { nestedAction, nestedConsiders, rootConsiders, finalizes, startDrag, moveOverNested, cleanUp };
}

// regression for #5
describe("a zone nested in the dragged item, destroyed mid-drag", () => {
    failOnListenerErrors();

    it("drops the item back into its origin zone when the shadow element was in the destroyed zone", async () => {
        const t = setUp({ draggedIndex: 0, dropAnimationDisabled: true });
        try {
            t.startDrag();
            await t.moveOverNested();
            await waitFor(
                () => hasShadow(t.nestedConsiders[t.nestedConsiders.length - 1]),
                "shadow in the nested zone",
            );

            // the framework destroys the nested zone while the drag runs
            t.nestedAction.destroy();
            const nestedConsiderCount = t.nestedConsiders.length;
            window.dispatchEvent(mouse("mouseup", 0, 0));

            expect(t.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_OUTSIDE_OF_ANY]);
            expect(t.finalizes[0].items.map((item) => item.id)).to.deep.equal(["dragged", "other"]);
            expect(t.nestedConsiders.length).to.equal(nestedConsiderCount);
        } finally {
            t.cleanUp();
        }
    });

    it("animates the drop back into the origin zone when the dragged item was the last one", async () => {
        const t = setUp({ draggedIndex: 1, dropAnimationDisabled: false });
        try {
            t.startDrag();
            await t.moveOverNested();
            await waitFor(
                () => hasShadow(t.nestedConsiders[t.nestedConsiders.length - 1]),
                "shadow in the nested zone",
            );

            t.nestedAction.destroy();
            window.dispatchEvent(mouse("mouseup", 0, 0));
            await waitFor(() => t.finalizes.length > 0, "finalize");

            expect(t.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_OUTSIDE_OF_ANY]);
            expect(t.finalizes[0].items.map((item) => item.id)).to.deep.equal(["other", "dragged"]);
        } finally {
            t.cleanUp();
        }
    });

    it("keeps the origin items when the pointer passes the destroyed zone on its way out of all zones", async () => {
        const t = setUp({ draggedIndex: 0, dropAnimationDisabled: true });
        try {
            t.startDrag();
            moveTo(OVER_ORIGIN.x, OVER_ORIGIN.y);
            // the observation started and the shadow element is in the origin zone
            await waitFor(() => t.rootConsiders.length > 1, "shadow in the origin zone");

            t.nestedAction.destroy();
            const nestedConsiderCount = t.nestedConsiders.length;
            await t.moveOverNested();
            await waitFor(() => t.rootConsiders.length > 2, "left the origin zone");
            moveTo(OUTSIDE_OF_ANY.x, OUTSIDE_OF_ANY.y);
            await letTheObserverRun();
            window.dispatchEvent(mouse("mouseup", OUTSIDE_OF_ANY.x, OUTSIDE_OF_ANY.y));

            expect(t.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_OUTSIDE_OF_ANY]);
            expect(t.finalizes[0].items.map((item) => item.id)).to.deep.equal(["dragged", "other"]);
            expect(t.nestedConsiders.length).to.equal(nestedConsiderCount);
        } finally {
            t.cleanUp();
        }
    });

    it("moves the shadow element from the destroyed zone into the origin zone", async () => {
        const t = setUp({ draggedIndex: 0, dropAnimationDisabled: true });
        try {
            t.startDrag();
            await t.moveOverNested();
            await waitFor(
                () => hasShadow(t.nestedConsiders[t.nestedConsiders.length - 1]),
                "shadow in the nested zone",
            );

            t.nestedAction.destroy();
            const nestedConsiderCount = t.nestedConsiders.length;
            const considerCount = t.rootConsiders.length;
            moveTo(OVER_ORIGIN.x, OVER_ORIGIN.y);
            await waitFor(
                () => t.rootConsiders.length > considerCount && hasShadow(t.rootConsiders[t.rootConsiders.length - 1]),
                "shadow back in the origin zone",
            );
            window.dispatchEvent(mouse("mouseup", OVER_ORIGIN.x, OVER_ORIGIN.y));

            expect(t.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ZONE]);
            expect(t.finalizes[0].items.map((item) => item.id).sort()).to.deep.equal(["dragged", "other"]);
            expect(t.nestedConsiders.length).to.equal(nestedConsiderCount);
        } finally {
            t.cleanUp();
        }
    });
});
