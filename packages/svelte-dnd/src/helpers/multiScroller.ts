import { makeScroller } from "./scroller";
import { printDebug } from "../constants";
import { getDepth, getWindowOf } from "./util";
import { isPointInsideRect, type Point } from "./intersection";

export type MultiScroller = {
    /** call this on every "tick" to scroll containers if needed, returns true if anything was scrolled */
    multiScrollIfNeeded: () => boolean;
    destroy: () => void;
};

/**
 * Creates a scroller than can scroll any of the provided containers or any of their scrollable parents (including the document's scrolling element)
 */
export function createMultiScroller(
    baseElementsForScrolling: HTMLElement[] = [],
    getPointerPosition: () => Point,
): MultiScroller {
    printDebug(() => "creating multi-scroller");
    const scrollingContainersSet = findRelevantScrollContainers(baseElementsForScrolling);
    const scrollingContainersDeepToShallow = Array.from(scrollingContainersSet).sort(
        (dz1, dz2) => getDepth(dz2) - getDepth(dz1),
    );
    const { scrollIfNeeded, resetScrolling } = makeScroller();

    /**
     * @return was any container scrolled
     */
    function tick(): boolean {
        const mousePosition = getPointerPosition();
        if (!mousePosition || !scrollingContainersDeepToShallow) {
            return false;
        }
        const scrollContainersUnderCursor = scrollingContainersDeepToShallow.filter(
            (el) =>
                isPointInsideRect(mousePosition, el.getBoundingClientRect()) ||
                el === el.ownerDocument.scrollingElement,
        );
        for (let i = 0; i < scrollContainersUnderCursor.length; i++) {
            const scrolled = scrollIfNeeded(mousePosition, scrollContainersUnderCursor[i]);
            if (scrolled) {
                return true;
            }
        }
        return false;
    }
    return {
        multiScrollIfNeeded: scrollingContainersSet.size > 0 ? tick : () => false,
        destroy: () => resetScrolling(),
    };
}

// internal utils
function findScrollableParents(element: HTMLElement): HTMLElement[] {
    if (!element) {
        return [];
    }
    const scrollableContainers: HTMLElement[] = [];
    let parent: HTMLElement | null = element;
    while (parent) {
        const { overflow } = getWindowOf(parent).getComputedStyle(parent);
        if (overflow.split(" ").some((o) => o.includes("auto") || o.includes("scroll"))) {
            scrollableContainers.push(parent);
        }
        parent = parent.parentElement;
    }
    return scrollableContainers;
}
function findRelevantScrollContainers(dropZones: HTMLElement[]): Set<HTMLElement> {
    const scrollingContainers = new Set<HTMLElement>();
    for (let dz of dropZones) {
        findScrollableParents(dz).forEach((container) => scrollingContainers.add(container));
        // The scrolling element might have overflow visible and still be scrollable
        // the drop zones live in HTML documents, whose scrollingElement is an element
        const { scrollingElement } = dz.ownerDocument as Document & { scrollingElement: HTMLElement };
        if (
            scrollingElement.scrollHeight > scrollingElement.clientHeight ||
            scrollingElement.scrollWidth > scrollingElement.clientHeight
        ) {
            scrollingContainers.add(scrollingElement);
        }
    }
    return scrollingContainers;
}
