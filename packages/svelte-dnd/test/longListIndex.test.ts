import { findWouldBeIndex, resetIndexesCache } from "../src/helpers/listUtil";
import { getAbsoluteRectNoTransforms, getScrollClips } from "../src/helpers/intersection";

const DEPTH = 10;
const ITEM_COUNT = 200;

/** A zone of ITEM_COUNT items, DEPTH elements below a scroller that clips it on both axes */
function buildLongList(): { root: HTMLElement; scroller: HTMLElement; zone: HTMLElement } {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const scroller = document.createElement("div");
    scroller.style.overflow = "auto";
    scroller.style.height = "300px";
    scroller.style.width = "150px";
    root.appendChild(scroller);
    let host = scroller;
    for (let d = 0; d < DEPTH; d++) {
        const div = document.createElement("div");
        host.appendChild(div);
        host = div;
    }
    const zone = document.createElement("ul");
    zone.style.margin = "0";
    zone.style.padding = "0";
    zone.style.width = "300px";
    host.appendChild(zone);
    for (let i = 0; i < ITEM_COUNT; i++) {
        const li = document.createElement("li");
        li.style.height = "20px";
        li.textContent = `item ${i}`;
        zone.appendChild(li);
    }
    return { root, scroller, zone };
}

describe("findWouldBeIndex in a long list", () => {
    let root: HTMLElement, scroller: HTMLElement, zone: HTMLElement;
    beforeEach(() => {
        ({ root, scroller, zone } = buildLongList());
    });
    afterEach(() => {
        vi.restoreAllMocks();
        resetIndexesCache();
        root.remove();
    });

    it("measures the scroll clips of the items once per call, not once per item", () => {
        scroller.scrollTop = scroller.scrollHeight;
        const last = zone.children[ITEM_COUNT - 1] as HTMLElement;
        const lastRect = last.getBoundingClientRect();
        const point = { x: lastRect.left + 5 + window.scrollX, y: lastRect.top + 5 + window.scrollY };
        const spy = vi.spyOn(window, "getComputedStyle");

        expect(findWouldBeIndex(point, zone)).to.deep.equal({ index: ITEM_COUNT - 1, isProximityBased: false });

        // one style read per item for its transform, plus the ancestor walks for the zone and the items, which do not
        // grow with the number of items. Walking the ancestors again for each item would take about ITEM_COUNT * DEPTH.
        expect(spy.mock.calls.length).to.be.below(ITEM_COUNT + 4 * DEPTH);
    });

    it("measures each item the same with shared clips as without them", () => {
        scroller.scrollTop = 1000;
        scroller.scrollLeft = 40;
        const clips = getScrollClips(zone);
        expect(clips.length, "the scroller clips the items").to.equal(1);
        for (const child of Array.from(zone.children) as HTMLElement[]) {
            expect(getAbsoluteRectNoTransforms(child, clips)).to.deep.equal(getAbsoluteRectNoTransforms(child));
        }
    });

    it("finds the item under a point in the visible part of a scrolled list", () => {
        scroller.scrollTop = 1000;
        const target = zone.children[55] as HTMLElement;
        const rect = target.getBoundingClientRect();
        const point = { x: rect.left + 5 + window.scrollX, y: rect.top + 10 + window.scrollY };
        expect(findWouldBeIndex(point, zone)).to.deep.equal({ index: 55, isProximityBased: false });
    });
});
