import { getWindowOf } from "./util";
import type { DndEventInfo, Item } from "../types";
import type { Index } from "./listUtil";

// Events are created in the window of the element they are dispatched on, so a listener in that window sees an
// instance of its own CustomEvent.
// external events
const FINALIZE_EVENT_NAME = "finalize";
const CONSIDER_EVENT_NAME = "consider";

export function dispatchFinalizeEvent(el: HTMLElement, items: Item[], info: DndEventInfo): void {
    el.dispatchEvent(
        new (getWindowOf(el).CustomEvent)(FINALIZE_EVENT_NAME, {
            detail: { items, info },
        }),
    );
}

/**
 * Dispatches a consider event
 */
export function dispatchConsiderEvent(el: HTMLElement, items: Item[], info: DndEventInfo): void {
    el.dispatchEvent(
        new (getWindowOf(el).CustomEvent)(CONSIDER_EVENT_NAME, {
            detail: { items, info },
        }),
    );
}

// internal events
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
