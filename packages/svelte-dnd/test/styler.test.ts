import { createDraggedElementFrom, morphDraggedElementToBeLike } from "../src/helpers/styler";

function createElement(width: number, height: number): HTMLElement {
    const element = document.createElement("div");
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.position = "fixed";
    element.style.left = "0px";
    element.style.top = "0px";
    document.body.appendChild(element);
    return element;
}

function stubRenderedRect(
    element: HTMLElement,
    { left, top, width, height }: { left: number; top: number; width: number; height: number },
): void {
    // only the fields the library reads
    element.getBoundingClientRect = () =>
        ({
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height,
        }) as DOMRect;
}

describe("styler", () => {
    [false, true].forEach((useComputedDimensions) => {
        it(`preserves the cursor position when remorphing during a transition (computed dimensions: ${useComputedDimensions})`, () => {
            const draggedEl = createElement(200, 200);
            const targetEl = createElement(100, 100);
            const nativeGetComputedStyle = window.getComputedStyle.bind(window);
            const getComputedStyleStub = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
                const computedStyle = nativeGetComputedStyle(element);
                if (element !== draggedEl) return computedStyle;
                return new Proxy(computedStyle, {
                    get(target, property) {
                        if (property === "left" || property === "top") return "25px";
                        const value = (target as any)[property];
                        return typeof value === "function" ? value.bind(target) : value;
                    },
                });
            });

            try {
                // Model the midpoint of a previous morph. Its inline destination is
                // 0px, while the currently rendered/animated position is 25px.
                stubRenderedRect(draggedEl, { left: 25, top: 25, width: 150, height: 150 });
                stubRenderedRect(targetEl, { left: 0, top: 0, width: 100, height: 100 });

                morphDraggedElementToBeLike(draggedEl, targetEl, 100, 100, useComputedDimensions);

                // The cursor is halfway across the rendered box, so a 100px target
                // must finish at 50px to keep the same relative grab point.
                expect(parseFloat(draggedEl.style.left)).to.equal(50);
                expect(parseFloat(draggedEl.style.top)).to.equal(50);
            } finally {
                getComputedStyleStub.mockRestore();
                draggedEl.remove();
                targetEl.remove();
            }
        });
    });

    it("synchronizes size transitions when morphing before delayed transition setup", () => {
        const originalEl = createElement(100, 100);
        const targetEl = createElement(200, 200);
        const nativeSetTimeout = window.setTimeout;
        window.setTimeout = (() => 1) as unknown as typeof window.setTimeout;
        let draggedEl: HTMLElement | undefined;

        try {
            draggedEl = createDraggedElementFrom(originalEl);
            document.body.appendChild(draggedEl);
            expect(draggedEl.style.transitionProperty.split(", ")).not.to.include("width");

            morphDraggedElementToBeLike(draggedEl, targetEl, 50, 50);

            const transitionProperties = draggedEl.style.transitionProperty.split(", ");
            expect(transitionProperties).to.include("width");
            expect(transitionProperties).to.include("height");
        } finally {
            window.setTimeout = nativeSetTimeout;
            originalEl.remove();
            targetEl.remove();
            if (draggedEl) draggedEl.remove();
        }
    });

    it("useComputedStyleForRects copies width and height to the dragged clone", () => {
        // the target's bounding rect lags behind its computed size, the situation of issue 454
        const targetEl = createElement(200, 160);
        stubRenderedRect(targetEl, { left: 0, top: 0, width: 300, height: 300 });
        const plainEl = createElement(100, 80);
        const computedEl = createElement(100, 80);

        try {
            morphDraggedElementToBeLike(plainEl, targetEl, 50, 50);
            morphDraggedElementToBeLike(computedEl, targetEl, 50, 50, true);

            expect(plainEl.style.width, "default: sized from the stale rect").to.equal("300px");
            expect(plainEl.style.height).to.equal("300px");
            expect(computedEl.style.width, "flag: the computed width is copied").to.equal("200px");
            expect(computedEl.style.height).to.equal("160px");
        } finally {
            targetEl.remove();
            plainEl.remove();
            computedEl.remove();
        }
    });
});
