// A window with its globals typed (CustomEvent, getComputedStyle and so on), the type of document.defaultView.
export type WindowWithGlobals = NonNullable<Document["defaultView"]>;

/**
 * The window an element lives in. A drop zone can live in another window than the one that
 * loaded this module, for example a same-origin iframe or a popup opened with window.open.
 */
export function getWindowOf(el: Node): WindowWithGlobals {
    // ownerDocument is only null for a Document node, and callers pass elements
    // eslint-disable-next-line no-restricted-globals -- for a document without a window, e.g. after its window closed
    return el.ownerDocument!.defaultView || window;
}

/**
 * Schedules a timeout on the given window. Work for a zone runs on the zone's window: the browser throttles
 * or stops the timers of a hidden window, and the loading window can be hidden while the zone's is not.
 * @return pass it to clearTimeoutIn
 */
export function setTimeoutIn(win: Window, callback: () => void, ms: number): { win: Window; id: number } {
    return { win, id: win.setTimeout(callback, ms) };
}

/**
 * Cancels a timeout through the window that scheduled it
 * @param timeout - from setTimeoutIn
 */
export function clearTimeoutIn(timeout?: { win: Window; id: number }): void {
    if (timeout) timeout.win.clearTimeout(timeout.id);
}

/**
 */
export function toString(object: unknown): string {
    return JSON.stringify(object, null, 2);
}

/**
 * Finds the depth of the given node in the DOM tree
 * @return the depth of the node
 */
export function getDepth(node: HTMLElement): number {
    if (!node) {
        throw new Error("cannot get depth of a falsy node");
    }
    return _getDepth(node, 0);
}
function _getDepth(node: HTMLElement, countSoFar = 0): number {
    if (!node.parentElement) {
        return countSoFar - 1;
    }
    return _getDepth(node.parentElement, countSoFar + 1);
}

/**
 * A simple util to shallow compare objects quickly, it doesn't validate the arguments so pass objects in
 * @return true if objA and objB are shallow equal
 */
export function areObjectsShallowEqual(objA: Record<string, unknown>, objB: Record<string, unknown>): boolean {
    if (Object.keys(objA).length !== Object.keys(objB).length) {
        return false;
    }
    for (const keyA in objA) {
        if (!{}.hasOwnProperty.call(objB, keyA) || objB[keyA] !== objA[keyA]) {
            return false;
        }
    }
    return true;
}

/**
 * Shallow compares two arrays
 * @return whether the arrays are shallow equal
 */
export function areArraysShallowEqualSameOrder(arrA: readonly unknown[], arrB: readonly unknown[]): boolean {
    if (arrA.length !== arrB.length) {
        return false;
    }
    for (let i = 0; i < arrA.length; i++) {
        if (arrA[i] !== arrB[i]) {
            return false;
        }
    }
    return true;
}
