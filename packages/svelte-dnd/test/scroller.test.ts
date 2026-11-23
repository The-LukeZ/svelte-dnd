import { makeScroller } from "../src/helpers/scroller";
import { configure } from "../src/configure";

describe("scroller", () => {
    let container: HTMLElement;
    let scrollBy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        document.body.style.margin = "0";
        // 400px tall container at the top left of the page that scrolls vertically
        container = document.createElement("div");
        container.style.cssText = "position: absolute; top: 0; left: 0; width: 200px; height: 400px; overflow: auto";
        const content = document.createElement("div");
        content.style.cssText = "height: 2000px";
        container.appendChild(content);
        document.body.appendChild(container);
        // record the steps instead of scrolling, so the frames that follow do not move the container
        scrollBy = vi.spyOn(container, "scrollBy").mockImplementation(() => {});
    });

    afterEach(() => {
        configure({ autoScrollEdgePx: null, autoScrollMaxStepPx: null });
        container.remove();
    });

    // the step of the first scroll, in pixels down
    function firstStepAt(distanceFromBottomPx: number): number | undefined {
        const scroller = makeScroller();
        try {
            const scrolled = scroller.scrollIfNeeded({ x: 100, y: 400 - distanceFromBottomPx }, container);
            if (!scrolled) return undefined;
            const [x, y] = scrollBy.mock.calls[0] as [number, number];
            expect(x).to.equal(0);
            return y;
        } finally {
            scroller.resetScrolling();
        }
    }

    it("by default scrolls within 30px of the edge, by 30px minus the distance", () => {
        expect(firstStepAt(31)).to.equal(undefined);
        expect(firstStepAt(10)).to.equal(20);
        scrollBy.mockClear();
        expect(firstStepAt(0)).to.equal(30);
    });

    it("scrolls from further away with a larger autoScrollEdgePx, with the same top speed", () => {
        configure({ autoScrollEdgePx: 100 });
        expect(firstStepAt(101)).to.equal(undefined);
        expect(firstStepAt(50)).to.equal(15);
        scrollBy.mockClear();
        expect(firstStepAt(0)).to.equal(30);
    });

    it("autoScrollMaxStepPx sets the step at the edge", () => {
        configure({ autoScrollMaxStepPx: 60 });
        expect(firstStepAt(31)).to.equal(undefined);
        expect(firstStepAt(15)).to.equal(30);
        scrollBy.mockClear();
        expect(firstStepAt(0)).to.equal(60);
    });

    it("null restores the defaults", () => {
        configure({ autoScrollEdgePx: 100, autoScrollMaxStepPx: 60 });
        configure({ autoScrollEdgePx: null, autoScrollMaxStepPx: null });
        expect(firstStepAt(31)).to.equal(undefined);
        expect(firstStepAt(10)).to.equal(20);
    });

    it("throws on a value that is not a positive number, and applies nothing", () => {
        for (const value of [0, -5, Number.NaN, Infinity, "30"]) {
            expect(() => configure({ autoScrollEdgePx: value as never })).to.throw("autoScrollEdgePx");
            expect(() => configure({ autoScrollMaxStepPx: value as never })).to.throw("autoScrollMaxStepPx");
        }
        expect(() => configure({ autoScrollEdgePx: 100, autoScrollMaxStepPx: -1 })).to.throw();
        expect(firstStepAt(31)).to.equal(undefined);
    });
});
