import { getWindowOf } from "./util";

export type Rect = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

export type Point = {
    x: number;
    y: number;
};

// what getBoundingRectNoTransforms returns, a Rect and, when it has them, the position and size
export type BoundingRect = Rect & { x?: number; y?: number; width?: number; height?: number };

// what getVisibleRectRecursive measures, a Rect plus its size
type VisibleRect = Rect & { width: number; height: number };

/** A scrollable ancestor that can clip an element, with its rect and the axes it scrolls on */
export type ScrollClip = { rect: DOMRect; clipsY: boolean; clipsX: boolean };

// This is based off https://stackoverflow.com/questions/27745438/how-to-compute-getboundingclientrect-without-considering-transforms/57876601#57876601
// It removes the transforms that are potentially applied by the flip animations
/**
 * Gets the bounding rect but removes transforms (ex: flip animation)
 * @param onlyVisible - use the visible rect defaults to true
 * @param clips - the scroll clips of the element's ancestors, as getScrollClips(el.parentElement) returns them. They
 * are measured when left out. Siblings share their ancestors, so a caller that measures many siblings measures the
 * clips once and passes them to each call.
 */
export function getBoundingRectNoTransforms(
    el: HTMLElement,
    onlyVisible = true,
    clips?: readonly ScrollClip[],
): BoundingRect {
    let ta: string[];
    const rect = onlyVisible ? getVisibleRectRecursive(el, clips) : el.getBoundingClientRect();
    const style = getWindowOf(el).getComputedStyle(el);
    const tx = style.transform;

    if (tx) {
        let sx: number, sy: number, dx: number, dy: number;
        if (tx.startsWith("matrix3d(")) {
            ta = tx.slice(9, -1).split(/, /);
            sx = +ta[0];
            sy = +ta[5];
            dx = +ta[12];
            dy = +ta[13];
        } else if (tx.startsWith("matrix(")) {
            ta = tx.slice(7, -1).split(/, /);
            sx = +ta[0];
            sy = +ta[3];
            dx = +ta[4];
            dy = +ta[5];
        } else {
            return rect;
        }

        const to = style.transformOrigin;
        const x = rect.left - dx - (1 - sx) * parseFloat(to);
        const y = rect.top - dy - (1 - sy) * parseFloat(to.slice(to.indexOf(" ") + 1));
        const w = sx ? rect.width / sx : el.offsetWidth;
        const h = sy ? rect.height / sy : el.offsetHeight;
        return {
            x: x,
            y: y,
            width: w,
            height: h,
            top: y,
            right: x + w,
            bottom: y + h,
            left: x,
        };
    } else {
        return rect;
    }
}

/**
 * Gets the absolute bounding rect (accounts for the window's scroll position and removes transforms)
 * @param clips - the scroll clips of the element's ancestors, see getBoundingRectNoTransforms
 */
export function getAbsoluteRectNoTransforms(el: HTMLElement, clips?: readonly ScrollClip[]): Rect {
    const rect = getBoundingRectNoTransforms(el, true, clips);
    const win = getWindowOf(el);
    return {
        top: rect.top + win.scrollY,
        bottom: rect.bottom + win.scrollY,
        left: rect.left + win.scrollX,
        right: rect.right + win.scrollX,
    };
}

/**
 * Gets the absolute bounding rect (accounts for the window's scroll position)
 */
export function getAbsoluteRect(el: HTMLElement): Rect {
    const rect = el.getBoundingClientRect();
    const win = getWindowOf(el);
    return {
        top: rect.top + win.scrollY,
        bottom: rect.bottom + win.scrollY,
        left: rect.left + win.scrollX,
        right: rect.right + win.scrollX,
    };
}

/**
 * finds the center :)
 */
export function findCenter(rect: Rect): Point {
    return {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2,
    };
}

function calcDistance(pointA: Point, pointB: Point): number {
    return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2));
}

export function isPointInsideRect(point: Point, rect: Rect): boolean {
    return point.y <= rect.bottom && point.y >= rect.top && point.x >= rect.left && point.x <= rect.right;
}

/**
 * find the absolute coordinates of the center of a dom element
 */
export function findCenterOfElement(el: HTMLElement): Point {
    return findCenter(getAbsoluteRect(el));
}

/**
 * Calculate distance from a point to the center of an element
 */
export function calcDistanceFromPointToCenter(point: Point, el: HTMLElement | ChildNode): number {
    // callers pass the dnd zone's children and the phantom, which are HTMLElements
    const centerOfEl = findCenterOfElement(el as HTMLElement);
    return calcDistance(point, centerOfEl);
}

/**
 * @param el - the element to check
 * @returns true if the element in its entirety is off-screen including the scrollable area (the normal dom events look at the mouse rather than the element)
 */
export function isElementOffDocument(el: HTMLElement): boolean {
    const rect = getAbsoluteRect(el);
    const { documentElement } = el.ownerDocument;
    return (
        rect.right < 0 ||
        rect.left > documentElement.scrollWidth ||
        rect.bottom < 0 ||
        rect.top > documentElement.scrollHeight
    );
}

/**
 * The scrollable elements (overflow: auto|scroll) from the given element up to the body, the given element included and
 * the body excluded, closest first, with their current rects. getVisibleRectRecursive clips an element by the clips of
 * its parent.
 */
export function getScrollClips(from: Element | null): ScrollClip[] {
    const clips: ScrollClip[] = [];
    let parent = from;
    while (parent && parent !== parent.ownerDocument.body) {
        const style = getWindowOf(parent).getComputedStyle(parent);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        const clipsY = overflowY === "scroll" || overflowY === "auto";
        const clipsX = overflowX === "scroll" || overflowX === "auto";
        if (clipsY || clipsX) {
            clips.push({ rect: parent.getBoundingClientRect(), clipsY, clipsX });
        }
        parent = parent.parentElement;
    }
    return clips;
}

/**
 * Computes the portion of an element that is actually visible inside its scrollable
 * ancestor containers. If the element is clipped by any scrollable ancestor (overflow: auto|scroll),
 * the returned rect is the clipped one. If it is not clipped by any scrollable ancestor but is
 * partially or fully outside the viewport, the function returns the element's full bounding rect
 * (i.e. it does NOT clip to the viewport).
 *
 * This is useful for distinguishing "hidden because parent scrolls" from
 * "hidden because off-screen".
 *
 * @param element - The DOM element to measure.
 * @param clips - the scroll clips of the element's ancestors, measured when left out
 * @returns An object describing the visible rectangle in viewport coordinates.
 */
function getVisibleRectRecursive(
    element: HTMLElement,
    clips: readonly ScrollClip[] = getScrollClips(element.parentElement),
): VisibleRect {
    // original rect of the element (can be off-screen)
    const rect = element.getBoundingClientRect();

    // this will be our "clipped by scroll containers" rect
    let visibleRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
    };

    let wasClippedByScrollY = false;
    let wasClippedByScrollX = false;

    // clip ONLY by scrollable ancestors, from the closest one up
    for (const { rect: parentRect, clipsY, clipsX } of clips) {
        if (clipsY) {
            // if we actually shrink, mark it
            const newTop = Math.max(visibleRect.top, parentRect.top);
            const newBottom = Math.min(visibleRect.bottom, parentRect.bottom);
            if (newTop !== visibleRect.top || newBottom !== visibleRect.bottom) {
                wasClippedByScrollY = true;
            }
            visibleRect.top = newTop;
            visibleRect.bottom = newBottom;
        }

        if (clipsX) {
            const newLeft = Math.max(visibleRect.left, parentRect.left);
            const newRight = Math.min(visibleRect.right, parentRect.right);
            if (newLeft !== visibleRect.left || newRight !== visibleRect.right) {
                wasClippedByScrollX = true;
            }
            visibleRect.left = newLeft;
            visibleRect.right = newRight;
        }
    }

    // CASE 1: element was clipped by a scrollable container
    // → return the clipped rect (this is your 500px content inside 250px scroller case)
    if (wasClippedByScrollY || wasClippedByScrollX) {
        return {
            top: visibleRect.top,
            bottom: visibleRect.bottom,
            left: visibleRect.left,
            right: visibleRect.right,
            width: Math.max(0, visibleRect.right - visibleRect.left),
            height: Math.max(0, visibleRect.bottom - visibleRect.top),
        };
    }

    // CASE 2: not clipped by scroll containers
    // → we want the element’s FULL rect, even if it’s off-screen
    // i.e. do NOT clip to viewport
    return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: Math.max(0, rect.right - rect.left),
        height: Math.max(0, rect.bottom - rect.top),
    };
}
