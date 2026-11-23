import { isPointInsideRect, type Point, type Rect } from "./intersection";
import { getWindowOf, toString } from "./util";
const DEFAULT_AUTO_SCROLL_EDGE_PX = 30;
const DEFAULT_AUTO_SCROLL_MAX_STEP_PX = 30;
let autoScrollEdgePx = DEFAULT_AUTO_SCROLL_EDGE_PX;
let autoScrollMaxStepPx = DEFAULT_AUTO_SCROLL_MAX_STEP_PX;

/**
 * Checks an auto-scroll setting without applying it. Internal - configure uses it.
 * @throws {Error} if given anything other than a positive finite number, null, or undefined
 */
export function assertValidAutoScrollPx(key: string, value: unknown): void {
    if (value === null || value === undefined) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(
            `configure({ ${key} }) expects a positive number or null but instead got a ${typeof value}, ${toString(value)}`,
        );
    }
}

/**
 * Sets how close to the edge of a scroll container, in pixels, the pointer starts auto-scrolling it.
 * Set through configure({ autoScrollEdgePx }). null restores the default, 30.
 */
export function setAutoScrollEdgePx(px: number | null): void {
    autoScrollEdgePx = px ?? DEFAULT_AUTO_SCROLL_EDGE_PX;
}

/**
 * Sets how many pixels auto-scroll moves per frame when the pointer is at the edge.
 * Set through configure({ autoScrollMaxStepPx }). null restores the default, 30.
 */
export function setAutoScrollMaxStepPx(px: number | null): void {
    autoScrollMaxStepPx = px ?? DEFAULT_AUTO_SCROLL_MAX_STEP_PX;
}

export type Scroller = {
    scrollIfNeeded: (pointer: Point, elementToScroll: HTMLElement) => boolean;
    resetScrolling: () => void;
};

type DirectionObj = { x: number; y: number };

/**
 * Will make a scroller that can scroll any element given to it in any direction
 */
export function makeScroller(): Scroller {
    let scrollingInfo: { directionObj: DirectionObj | undefined; stepPx: number };
    function resetScrolling() {
        scrollingInfo = { directionObj: undefined, stepPx: 0 };
    }
    resetScrolling();
    // directionObj {x: 0|1|-1, y:0|1|-1} - 1 means down in y and right in x
    function scrollContainer(containerEl: HTMLElement) {
        const { directionObj, stepPx } = scrollingInfo;
        if (directionObj) {
            containerEl.scrollBy(directionObj.x * stepPx, directionObj.y * stepPx);
            getWindowOf(containerEl).requestAnimationFrame(() => scrollContainer(containerEl));
        }
    }
    function calcScrollStepPx(distancePx: number) {
        // grows from 0 where scrolling starts to the max step at the edge, 30 - distancePx with the defaults
        return (autoScrollEdgePx - distancePx) * (autoScrollMaxStepPx / autoScrollEdgePx);
    }

    /**
     * @param pointer - the pointer will be used to decide in which direction to scroll
     * @param elementToScroll - the scroll container
     * If the pointer is next to the sides of the element to scroll, will trigger scrolling
     * Can be called repeatedly with updated pointer and elementToScroll values without issues
     * @return true if scrolling was needed
     */
    function scrollIfNeeded(pointer: Point, elementToScroll: HTMLElement): boolean {
        if (!elementToScroll) {
            return false;
        }
        const distances = calcInnerDistancesBetweenPointAndSidesOfElement(pointer, elementToScroll);
        const isAlreadyScrolling = !!scrollingInfo.directionObj;
        if (distances === null) {
            if (isAlreadyScrolling) resetScrolling();
            return false;
        }
        let [scrollingVertically, scrollingHorizontally] = [false, false];
        // vertical
        if (elementToScroll.scrollHeight > elementToScroll.clientHeight) {
            if (distances.bottom < autoScrollEdgePx) {
                scrollingVertically = true;
                scrollingInfo.directionObj = { x: 0, y: 1 };
                scrollingInfo.stepPx = calcScrollStepPx(distances.bottom);
            } else if (distances.top < autoScrollEdgePx) {
                scrollingVertically = true;
                scrollingInfo.directionObj = { x: 0, y: -1 };
                scrollingInfo.stepPx = calcScrollStepPx(distances.top);
            }
            if (!isAlreadyScrolling && scrollingVertically) {
                scrollContainer(elementToScroll);
                return true;
            }
        }
        // horizontal
        if (elementToScroll.scrollWidth > elementToScroll.clientWidth) {
            if (distances.right < autoScrollEdgePx) {
                scrollingHorizontally = true;
                scrollingInfo.directionObj = { x: 1, y: 0 };
                scrollingInfo.stepPx = calcScrollStepPx(distances.right);
            } else if (distances.left < autoScrollEdgePx) {
                scrollingHorizontally = true;
                scrollingInfo.directionObj = { x: -1, y: 0 };
                scrollingInfo.stepPx = calcScrollStepPx(distances.left);
            }
            if (!isAlreadyScrolling && scrollingHorizontally) {
                scrollContainer(elementToScroll);
                return true;
            }
        }
        resetScrolling();
        return false;
    }

    return {
        scrollIfNeeded,
        resetScrolling,
    };
}

/**
 * If the point is inside the element returns its distances from the sides, otherwise returns null
 */
function calcInnerDistancesBetweenPointAndSidesOfElement(point: Point, el: HTMLElement): Rect | null {
    // Even if the scrolling element is small it acts as a scroller for the viewport
    const rect =
        el === el.ownerDocument.scrollingElement
            ? {
                  top: 0,
                  bottom: getWindowOf(el).innerHeight,
                  left: 0,
                  right: getWindowOf(el).innerWidth,
              }
            : el.getBoundingClientRect();
    if (!isPointInsideRect(point, rect)) {
        return null;
    }
    return {
        top: point.y - rect.top,
        bottom: rect.bottom - point.y,
        left: point.x - rect.left,
        right: rect.right - point.x,
    };
}
