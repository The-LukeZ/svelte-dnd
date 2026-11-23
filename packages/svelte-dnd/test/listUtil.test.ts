import { findWouldBeIndex, resetIndexesCache } from "../src/helpers/listUtil";
import { SHADOW_ELEMENT_ATTRIBUTE_NAME } from "../src/constants";
import { findCenterOfElement } from "../src/helpers/intersection";

describe("listUtil", () => {
    describe("findWouldBeIndex", () => {
        let containerEl: HTMLElement, draggedEl: HTMLElement;
        beforeEach(() => {
            document.body.style.height = "2000px";
            document.body.style.width = "2000px";

            containerEl = document.createElement("section");
            containerEl.style.height = "500px";
            containerEl.style.width = "100px";
            containerEl.style.position = "fixed";
            containerEl.style.top = "0";
            containerEl.style.left = "0";
            document.body.appendChild(containerEl);
            function addListItem() {
                const divEl = document.createElement("div");
                divEl.style.height = "100px";
                divEl.style.width = "50px";
                containerEl.appendChild(divEl);
            }
            addListItem();
            addListItem();
            addListItem();

            draggedEl = document.createElement("div");
            draggedEl.style.height = "100px";
            draggedEl.style.width = "50px";
            draggedEl.style.position = "fixed";
            document.body.appendChild(draggedEl);
            draggedEl.style.top = "0";
            draggedEl.style.left = "0";
        });
        afterEach(() => {
            resetIndexesCache();
            containerEl.remove();
            draggedEl.remove();
            document.body.style.height = "";
            document.body.style.width = "";
        });
        it("returns null when element is outside of containers", () => {
            draggedEl.style.top = "600px";
            draggedEl.style.left = "0";
            expect(findWouldBeIndex(findCenterOfElement(draggedEl), containerEl)).to.equal(null);
        });
        it("works correctly, not proximity based", () => {
            draggedEl.style.top = "150px";
            draggedEl.style.left = "5px";
            expect(findWouldBeIndex(findCenterOfElement(draggedEl), containerEl)).to.deep.equal({
                index: 1,
                isProximityBased: false,
            });
        });
        it("returns the trailing insertion slot when it is the closest", () => {
            draggedEl.style.top = "450px";
            draggedEl.style.left = "5px";
            expect(findWouldBeIndex(findCenterOfElement(draggedEl), containerEl)).to.deep.equal({
                index: 3,
                isProximityBased: true,
            });
        });
        // regression for #4
        it("returns the index under the point when the cached shadow rect is stale", () => {
            const firstChild = containerEl.children[0] as HTMLElement;
            // the shadow element sits at index 0, so its rect (top 0 to 100px) is cached
            firstChild.setAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME, "true");
            draggedEl.style.top = "0";
            draggedEl.style.left = "5px";
            expect(findWouldBeIndex(findCenterOfElement(draggedEl), containerEl)).to.deep.equal({
                index: 0,
                isProximityBased: false,
            });
            // the shadow element leaves the zone and the item now at index 0 is taller
            firstChild.removeAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME);
            firstChild.style.height = "200px";
            // the point is inside the child at index 0 but outside the stale cached rect
            draggedEl.style.top = "100px";
            expect(findWouldBeIndex(findCenterOfElement(draggedEl), containerEl)).to.deep.equal({
                index: 0,
                isProximityBased: false,
            });
        });
        // regression for upstream isaacHagoel/svelte-dnd-action#310: a small shadow element among tall items stayed
        // where it was while the point moved past a whole item, because the point missed the shadow rect cached for
        // the index under it
        it("moves the shadow element next to the item under the point when the point is past the items between", () => {
            const [a, b, shadow] = Array.from(containerEl.children) as HTMLElement[];
            a.style.height = "200px";
            b.style.height = "200px";
            shadow.style.height = "50px";
            shadow.setAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME, "true");
            const at = (y: number) => findWouldBeIndex({ x: 5, y }, containerEl);
            // the shadow element at index 2 (400px to 450px): its rect there is cached
            expect(at(425)).to.deep.equal({ index: 2, isProximityBased: false });
            // the point moves up, and the shadow element is now at index 0 (0 to 50px), above a (50px to 250px) and
            // b (250px to 450px)
            containerEl.prepend(shadow);
            expect(at(25)).to.deep.equal({ index: 0, isProximityBased: false });
            // the point moves down past a, into b. It misses the rect cached for index 2, so the shadow element does
            // not move below b, but it moves below a, next to b.
            expect(at(300)).to.deep.equal({ index: 1, isProximityBased: false });
        });
    });
});
