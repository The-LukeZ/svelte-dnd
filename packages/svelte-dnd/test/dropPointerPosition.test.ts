import { dndzone } from "../src/pointerAction";
import { SHADOW_ITEM_MARKER_PROPERTY_NAME, TRIGGERS } from "../src/constants";
import type { DndEvent, Item, Options } from "../src/types";
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

/** A zone at the given left edge, 200px from the top, with 50px high items. */
function createZone(left: number, ids: string[]) {
    const node = document.createElement("div");
    node.style.position = "fixed";
    node.style.top = "200px";
    node.style.left = `${left}px`;
    node.style.width = "100px";
    const elements = ids.map(() => {
        const el = document.createElement("div");
        el.style.height = "50px";
        return el;
    });
    node.append(...elements);
    document.body.appendChild(node);
    const considers: Item[][] = [];
    const finalizes: DndEvent[] = [];
    const options: Options = {
        items: ids.map((id): Item => ({ id })),
        dropAnimationDisabled: true,
        useCursorForDetection: true,
        onconsider: ({ items, info }) => {
            considers.push(items);
            // model the framework: it removes the dragged item's DOM node once its data entry became the shadow item
            if (info.trigger === TRIGGERS.DRAG_STARTED) elements[0].remove();
            action.update({ ...options, items });
        },
        onfinalize: (e) => {
            finalizes.push(e);
            action.update({ ...options, items: e.items });
        },
    };
    const action = dndzone(node, options);
    return { node, elements, considers, finalizes, destroy: () => action.destroy() };
}

// isaacHagoel/svelte-dnd-action#584: the finalize events of a pointer drag tell where the pointer was at the drop
describe("the pointer position of a drop", () => {
    failOnListenerErrors();

    let zones: ReturnType<typeof createZone>[];
    beforeEach(() => {
        zones = [];
    });
    afterEach(() => {
        window.dispatchEvent(mouse("mouseup", 0, 0));
        zones.forEach((z) => z.destroy());
        document.body.innerHTML = "";
    });

    async function startDrag(origin: ReturnType<typeof createZone>): Promise<void> {
        const dragged = origin.elements[0];
        const rect = dragged.getBoundingClientRect();
        dragged.dispatchEvent(mouse("mousedown", rect.left + 10, rect.top + 10));
        moveTo(rect.left + 20, rect.top + 20);
        await waitFor(() => dragged.isConnected && dragged.style.display === "none", "original element hidden");
    }

    it("is in the finalize event of a drop into the origin zone", async () => {
        const origin = createZone(200, ["dragged", "other"]);
        zones.push(origin);
        await startDrag(origin);
        moveTo(230, 270);
        await nextFrame();
        window.dispatchEvent(mouse("mouseup", 230, 270));

        expect(origin.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ZONE]);
        expect(origin.finalizes[0].info.pointerPosition).to.deep.equal({ x: 230, y: 270 });
    });

    it("is in both finalize events of a drop into another zone", async () => {
        const origin = createZone(200, ["dragged", "other"]);
        const target = createZone(400, ["target"]);
        zones.push(origin, target);
        await startDrag(origin);
        moveTo(420, 210);
        await waitFor(() => hasShadow(target.considers[target.considers.length - 1]), "shadow in the target zone");
        window.dispatchEvent(mouse("mouseup", 420, 210));

        expect(target.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ZONE]);
        expect(target.finalizes[0].info.pointerPosition).to.deep.equal({ x: 420, y: 210 });
        expect(origin.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ANOTHER]);
        expect(origin.finalizes[0].info.pointerPosition).to.deep.equal({ x: 420, y: 210 });
    });

    it("is in the finalize event of a drop outside of any zone", async () => {
        const origin = createZone(200, ["dragged", "other"]);
        zones.push(origin);
        await startDrag(origin);
        moveTo(700, 600);
        for (let i = 0; i < 5; i++) await nextFrame();
        window.dispatchEvent(mouse("mouseup", 700, 600));

        expect(origin.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_OUTSIDE_OF_ANY]);
        expect(origin.finalizes[0].info.pointerPosition).to.deep.equal({ x: 700, y: 600 });
    });
});
