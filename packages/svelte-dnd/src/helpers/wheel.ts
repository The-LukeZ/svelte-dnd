import { getWindowOf } from "./util";

// how many pixels a wheel step counts when the browser reports it in lines (Firefox does)
const LINE_HEIGHT_PX = 16;

/**
 * The dragged element sits under the pointer, so the browser targets wheel events at it. It is fixed and lives
 * outside the zone's scroll containers, so its scroll chain only reaches the page and the containers under it never
 * scroll. This passes the wheel on to the nearest container under the dragged element that can scroll that way.
 * When none can, the page is left to the browser.
 * The listener goes away with the dragged element.
 * @param onScrolled - called after the wheel scrolled a container
 */
export function forwardWheelToScrollContainersBelow(draggedEl: HTMLElement, onScrolled: () => void): void {
    draggedEl.addEventListener(
        "wheel",
        (e: WheelEvent) => {
            // pinch zoom arrives as a wheel event with ctrlKey, leave it to the browser
            if (e.ctrlKey) return;
            // deltaMode 1 counts lines, 2 counts pages (null: a page is the container's size, worked out below)
            const scale = e.deltaMode === 1 ? LINE_HEIGHT_PX : e.deltaMode === 2 ? null : 1;
            // the dragged element lives in the document or in the origin zone's shadow root
            const below = (draggedEl.getRootNode() as Document | ShadowRoot)
                .elementsFromPoint(e.clientX, e.clientY)
                .find((el) => el !== draggedEl && !draggedEl.contains(el));
            for (let el = below as HTMLElement | null | undefined; el; el = parentOf(el)) {
                // the page is in the dragged element's own scroll chain: the browser scrolls it, smoothly
                if (el === el.ownerDocument.scrollingElement) return;
                const dx = scale === null ? Math.sign(e.deltaX) * el.clientWidth : e.deltaX * scale;
                const dy = scale === null ? Math.sign(e.deltaY) * el.clientHeight : e.deltaY * scale;
                if (canScroll(el, dx, dy)) {
                    e.preventDefault();
                    el.scrollBy(dx, dy);
                    onScrolled();
                    return;
                }
            }
        },
        { passive: false },
    );
}

function parentOf(el: Element): HTMLElement | null {
    return (el.parentElement ?? ((el.getRootNode() as ShadowRoot).host as HTMLElement | undefined)) || null;
}

function canScroll(el: HTMLElement, dx: number, dy: number): boolean {
    const { overflowX, overflowY } = getWindowOf(el).getComputedStyle(el);
    const scrollable = (overflow: string) => overflow === "auto" || overflow === "scroll";
    const canScrollY =
        dy !== 0 &&
        scrollable(overflowY) &&
        (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0);
    const canScrollX =
        dx !== 0 &&
        scrollable(overflowX) &&
        (dx > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0);
    return canScrollY || canScrollX;
}
