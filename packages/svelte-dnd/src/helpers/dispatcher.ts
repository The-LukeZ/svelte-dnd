import { getWindowOf } from "./util";
import type { DndEvent, DndEventInfo, Item } from "../types";
import type { Index } from "./listUtil";

// external callbacks
export interface ZoneCallbacks {
    onconsider?: (e: DndEvent) => void;
    onfinalize?: (e: DndEvent) => void;
}

// The user's callbacks, set from the zone's options on every configure and removed when the zone is torn down, so a
// torn-down zone that the engine still keeps until the drop ends gets no callbacks.
const zoneToCallbacks = new WeakMap<HTMLElement, ZoneCallbacks>();
// Internal hooks run before the user's callbacks and stay after the zone is torn down, so a wrapper's bookkeeping (the
// handle zone's isItemsDragDisabled reset) still runs on the events the engine sends to a torn-down zone.
const zoneToInternalHooks = new WeakMap<HTMLElement, ZoneCallbacks>();

/**
 * Sets the zone's callbacks, replacing any set before. They are read at call time.
 */
export function registerZoneCallbacks(el: HTMLElement, callbacks: ZoneCallbacks): void {
    zoneToCallbacks.set(el, callbacks);
}

export function unregisterZoneCallbacks(el: HTMLElement): void {
    zoneToCallbacks.delete(el);
}

/**
 * Sets the zone's internal hooks, replacing any set before. unregisterZoneCallbacks leaves them in place, so they keep
 * running for a zone torn down mid-drag until the drop ends.
 */
export function registerZoneInternalHooks(el: HTMLElement, hooks: ZoneCallbacks): void {
    zoneToInternalHooks.set(el, hooks);
}

function call(el: HTMLElement, callback: ((e: DndEvent) => void) | undefined, detail: DndEvent): void {
    if (!callback) return;
    try {
        callback(detail);
    } catch (err) {
        // a throwing callback must not break the drag, so it is reported the way an event listener's error is
        getWindowOf(el).reportError(err);
    }
}

export function dispatchFinalizeEvent(el: HTMLElement, items: Item[], info: DndEventInfo): void {
    const detail = { items, info };
    call(el, zoneToInternalHooks.get(el)?.onfinalize, detail);
    call(el, zoneToCallbacks.get(el)?.onfinalize, detail);
}

/**
 * Calls the zone's consider callback
 */
export function dispatchConsiderEvent(el: HTMLElement, items: Item[], info: DndEventInfo): void {
    const detail = { items, info };
    call(el, zoneToInternalHooks.get(el)?.onconsider, detail);
    call(el, zoneToCallbacks.get(el)?.onconsider, detail);
}

// internal events
// Events are created in the window of the element they are dispatched on, so a listener in that window sees an
// instance of its own CustomEvent.
export const DRAGGED_ENTERED_EVENT_NAME = "draggedEntered";
export const DRAGGED_LEFT_EVENT_NAME = "draggedLeft";
export const DRAGGED_OVER_INDEX_EVENT_NAME = "draggedOverIndex";
export const DRAGGED_LEFT_DOCUMENT_EVENT_NAME = "draggedLeftDocument";

export const DRAGGED_LEFT_TYPES = {
    LEFT_FOR_ANOTHER: "leftForAnother",
    OUTSIDE_OF_ANY: "outsideOfAny",
};

export function dispatchDraggedElementEnteredContainer(
    containerEl: HTMLElement,
    indexObj: Index,
    draggedEl: HTMLElement,
): void {
    containerEl.dispatchEvent(
        new (getWindowOf(containerEl).CustomEvent)(DRAGGED_ENTERED_EVENT_NAME, {
            detail: { indexObj, draggedEl },
        }),
    );
}

/**
 * @param containerEl - the dropzone the element left
 * @param draggedEl - the dragged element
 * @param theOtherDz - the new dropzone the element entered
 */
export function dispatchDraggedElementLeftContainerForAnother(
    containerEl: HTMLElement,
    draggedEl: HTMLElement,
    theOtherDz: HTMLElement,
): void {
    containerEl.dispatchEvent(
        new (getWindowOf(containerEl).CustomEvent)(DRAGGED_LEFT_EVENT_NAME, {
            detail: { draggedEl, type: DRAGGED_LEFT_TYPES.LEFT_FOR_ANOTHER, theOtherDz },
        }),
    );
}

export function dispatchDraggedElementLeftContainerForNone(containerEl: HTMLElement, draggedEl: HTMLElement): void {
    containerEl.dispatchEvent(
        new (getWindowOf(containerEl).CustomEvent)(DRAGGED_LEFT_EVENT_NAME, {
            detail: { draggedEl, type: DRAGGED_LEFT_TYPES.OUTSIDE_OF_ANY },
        }),
    );
}
export function dispatchDraggedElementIsOverIndex(
    containerEl: HTMLElement,
    indexObj: Index,
    draggedEl: HTMLElement,
): void {
    containerEl.dispatchEvent(
        new (getWindowOf(containerEl).CustomEvent)(DRAGGED_OVER_INDEX_EVENT_NAME, {
            detail: { indexObj, draggedEl },
        }),
    );
}
export function dispatchDraggedLeftDocument(draggedEl: HTMLElement): void {
    const win = getWindowOf(draggedEl);
    win.dispatchEvent(
        new win.CustomEvent(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, {
            detail: { draggedEl },
        }),
    );
}
