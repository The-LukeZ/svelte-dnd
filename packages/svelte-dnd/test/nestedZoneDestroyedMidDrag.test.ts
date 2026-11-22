import { dndzone } from "../src/pointerAction";
import { SHADOW_ITEM_MARKER_PROPERTY_NAME, TRIGGERS } from "../src/constants";
import type { DndEvent, Item, Options } from "../src/types";
import { createList, failOnListenerErrors } from "./helpers/otherWindow";

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

    const nestedConsiders: Item[][] = [];
    const rootConsiders: Item[][] = [];
    const finalizes: DndEvent[] = [];
    const options: Options = {
        items: ids.map((id): Item => ({ id })),
        dropAnimationDisabled,
        useCursorForDetection: true,
        onconsider: ({ items, info }) => {
            rootConsiders.push(items);
            // model the framework: it removes the dragged item's DOM node once its data entry became the shadow item,
            // and it feeds the new items back into the zone
            if (info.trigger === TRIGGERS.DRAG_STARTED) draggedItem.remove();
            rootAction.update({ ...options, items });
        },
        onfinalize: (e) => {
            finalizes.push(e);
        },
    };
    // the nested zone is set up first, like Svelte does for a nested action
    const nestedAction = dndzone(nestedZone, {
        ...options,
        items: [{ id: "nested" }],
        onconsider: (e) => {
            nestedConsiders.push(e.items);
        },
        onfinalize: undefined,
    });
    const rootAction = dndzone(rootZone, options);

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

// The engine keeps a pointer zone destroyed mid-drag until the drop ends. Its callbacks are gone with the teardown.
describe("a pointer zone destroyed mid-drag and kept until the drop ends", () => {
    failOnListenerErrors();
    const cleanups: (() => void)[] = [];
    afterEach(() => cleanups.splice(0).forEach((cleanUp) => cleanUp()));

    function setUpTwoLists() {
        const options = { flipDurationMs: 0, dropAnimationDisabled: true, useCursorForDetection: true };
        const origin = createList(document, {
            label: "Origin",
            names: ["o1", "o2"],
            style: { position: "fixed", top: "0", left: "0" },
            ...options,
        });
        const target = createList(document, {
            label: "Target",
            names: ["t1"],
            style: { position: "fixed", top: "200px", left: "0" },
            ...options,
        });
        cleanups.push(() => {
            window.dispatchEvent(mouse("mouseup", 0, 0));
            origin.action.destroy();
            target.action.destroy();
            origin.zone.remove();
            target.zone.remove();
        });
        return { origin, target };
    }

    async function dragIntoTarget({ origin, target }: ReturnType<typeof setUpTwoLists>): Promise<void> {
        origin.element("o1").dispatchEvent(mouse("mousedown", 10, 10));
        moveTo(20, 20);
        moveTo(10, 215);
        await waitFor(() => target.triggers.includes(TRIGGERS.DRAGGED_ENTERED), "the target zone entered");
    }

    it("does not call a pointer zone destroyed mid-drag and scheduled for removal", async () => {
        const lists = setUpTwoLists();
        const { origin, target } = lists;
        await dragIntoTarget(lists);

        target.action.destroy();
        const targetCalls = target.events.length;
        const originCalls = origin.events.length;
        window.dispatchEvent(mouse("mouseup", 10, 215));

        expect(target.events.length, "the destroyed zone gets no calls").to.equal(targetCalls);
        expect(
            origin.events.slice(originCalls).map(({ type, detail }) => [type, detail.info.trigger]),
            "the live zone still gets its finalize",
        ).to.deep.equal([["finalize", TRIGGERS.DROPPED_INTO_ANOTHER]]);
    });

    it("does not call the origin zone's onfinalize after DROPPED_INTO_ANOTHER when it was destroyed", async () => {
        const lists = setUpTwoLists();
        const { origin, target } = lists;
        await dragIntoTarget(lists);

        origin.action.destroy();
        const originCalls = origin.events.length;
        const targetCalls = target.events.length;
        window.dispatchEvent(mouse("mouseup", 10, 215));

        expect(origin.events.length, "the destroyed zone gets no calls").to.equal(originCalls);
        expect(
            target.events.slice(targetCalls).map(({ type, detail }) => [type, detail.info.trigger]),
            "the live zone still gets its finalize",
        ).to.deep.equal([["finalize", TRIGGERS.DROPPED_INTO_ZONE]]);
        expect(target.names()).to.deep.equal(["o1", "t1"]);
    });
});
