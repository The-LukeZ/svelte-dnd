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

function zoneAt(left: number): HTMLElement {
    const zone = document.createElement("div");
    zone.style.position = "fixed";
    zone.style.top = "200px";
    zone.style.left = `${left}px`;
    zone.style.width = "100px";
    zone.style.minHeight = "50px";
    document.body.appendChild(zone);
    return zone;
}

function item(): HTMLElement {
    const el = document.createElement("div");
    el.style.height = "50px";
    return el;
}

// regression for isaacHagoel/svelte-dnd-action#479: a zone mounted while an item is dragged, for example a collapsed
// node that opens on hover, has to take the drop like the zones that were there when the drag started
describe("a zone created mid-drag", () => {
    failOnListenerErrors();

    let cleanUps: (() => void)[];
    beforeEach(() => {
        cleanUps = [];
    });
    afterEach(() => {
        window.dispatchEvent(mouse("mouseup", 0, 0));
        cleanUps.forEach((c) => c());
        document.body.innerHTML = "";
    });

    function startDragInOrigin() {
        const originZone = zoneAt(200);
        const dragged = item();
        originZone.append(dragged, item());
        const originOptions: Options = {
            items: [{ id: "dragged" }, { id: "other" }],
            dropAnimationDisabled: true,
            useCursorForDetection: true,
            onconsider: ({ items, info }) => {
                // model the framework: it removes the dragged item's DOM node once its data entry became the shadow item
                if (info.trigger === TRIGGERS.DRAG_STARTED) dragged.remove();
                origin.update({ ...originOptions, items });
            },
            onfinalize: ({ items }) => origin.update({ ...originOptions, items }),
        };
        const origin = dndzone(originZone, originOptions);
        cleanUps.push(() => origin.destroy());
        const rect = dragged.getBoundingClientRect();
        dragged.dispatchEvent(mouse("mousedown", rect.left + 10, rect.top + 10));
        moveTo(rect.left + 20, rect.top + 20);
        return { dragged };
    }

    function createLateZone(options: Partial<Options> = {}) {
        const lateZone = zoneAt(400);
        lateZone.appendChild(item());
        const considers: Item[][] = [];
        const finalizes: DndEvent[] = [];
        const lateOptions: Options = {
            items: [{ id: "late" }],
            dropAnimationDisabled: true,
            useCursorForDetection: true,
            onconsider: ({ items }) => {
                considers.push(items);
                late.update({ ...lateOptions, items });
            },
            onfinalize: (e) => {
                finalizes.push(e);
            },
            ...options,
        };
        const late = dndzone(lateZone, lateOptions);
        cleanUps.push(() => late.destroy());
        return { lateZone, considers, finalizes };
    }

    it("takes the shadow item and the drop", async () => {
        const { dragged } = startDragInOrigin();
        await waitFor(() => dragged.isConnected && dragged.style.display === "none", "original element hidden");

        const late = createLateZone();
        const rect = late.lateZone.getBoundingClientRect();
        moveTo(rect.left + 20, rect.top + 10);
        await waitFor(() => hasShadow(late.considers[late.considers.length - 1]), "shadow in the late zone");

        window.dispatchEvent(mouse("mouseup", rect.left + 20, rect.top + 10));
        expect(late.finalizes.map((f) => f.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ZONE]);
        expect(late.finalizes[0].items.map((i) => i.id)).to.have.members(["late", "dragged"]);
    });

    it("takes the shadow item when it is created under a pointer that does not move", async () => {
        const { dragged } = startDragInOrigin();
        await waitFor(() => dragged.isConnected && dragged.style.display === "none", "original element hidden");
        moveTo(420, 210);

        const late = createLateZone();
        await waitFor(() => hasShadow(late.considers[late.considers.length - 1]), "shadow in the late zone");
    });

    it("is styled as an active drop target", async () => {
        const { dragged } = startDragInOrigin();
        await waitFor(() => dragged.isConnected && dragged.style.display === "none", "original element hidden");

        const late = createLateZone({ dropTargetClasses: ["active-target"] });
        expect(late.lateZone.classList.contains("active-target")).to.equal(true);
    });

    it("is not watched when its type differs from the dragged item's", async () => {
        const { dragged } = startDragInOrigin();
        await waitFor(() => dragged.isConnected && dragged.style.display === "none", "original element hidden");

        const late = createLateZone({ type: "other-type", dropTargetClasses: ["active-target"] });
        const rect = late.lateZone.getBoundingClientRect();
        moveTo(rect.left + 20, rect.top + 10);
        for (let i = 0; i < 10; i++) await nextFrame();
        expect(late.considers).to.deep.equal([]);
        expect(late.lateZone.classList.contains("active-target")).to.equal(false);
    });
});
