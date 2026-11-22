import {
    decrementActiveDropZoneCount,
    incrementActiveDropZoneCount,
    ITEM_ID_KEY,
    printDebug,
    SHADOW_ELEMENT_ATTRIBUTE_NAME,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    SOURCES,
    TRIGGERS,
} from "./constants";
import { observe, unobserve } from "./helpers/observer";
import { createMultiScroller, type MultiScroller } from "./helpers/multiScroller";
import {
    createDraggedElementFrom,
    decorateShadowEl,
    hideElement,
    morphDraggedElementToBeLike,
    moveDraggedElementToWasDroppedState,
    preventShrinking,
    styleActiveDropZones,
    styleDraggable,
    styleInactiveDropZones,
    unDecorateShadowElement,
} from "./helpers/styler";
import {
    dispatchConsiderEvent,
    dispatchFinalizeEvent,
    registerZoneCallbacks,
    unregisterZoneCallbacks,
    DRAGGED_ENTERED_EVENT_NAME,
    DRAGGED_LEFT_DOCUMENT_EVENT_NAME,
    DRAGGED_LEFT_EVENT_NAME,
    DRAGGED_LEFT_TYPES,
    DRAGGED_OVER_INDEX_EVENT_NAME,
} from "./helpers/dispatcher";
import {
    areArraysShallowEqualSameOrder,
    areObjectsShallowEqual,
    clearTimeoutIn,
    getWindowOf,
    setTimeoutIn,
    toString,
    type WindowWithGlobals,
} from "./helpers/util";
import { getBoundingRectNoTransforms, findCenterOfElement, type Point } from "./helpers/intersection";
import type { Index } from "./helpers/listUtil";
import type { ZoneCallbacks } from "./helpers/dispatcher";
import type { Item, Options, TransformDraggedElementFunction } from "./types";

// The config of a zone. dropAnimationDurationMs holds the flipDurationMs option.
type Config = {
    items: Item[];
    type: string;
    flipDurationMs: number;
    dragDisabled: boolean;
    morphDisabled: boolean;
    dropFromOthersDisabled: boolean;
    dropTargetStyle: Record<string, string>;
    dropTargetClasses: string[];
    transformDraggedElement: TransformDraggedElementFunction;
    centreDraggedOnCursor: boolean;
    useCursorForDetection: boolean;
    dropAnimationDisabled: boolean;
    delayTouchStartMs: number;
    dropAnimationDurationMs: number;
    useComputedStyleForRects: boolean;
};
// The internal drag events (see helpers/dispatcher), heard on the drop zone they were dispatched on
type DropZoneEvent<Detail> = CustomEvent<Detail> & { currentTarget: HTMLElement };
type DraggedOverDetail = { indexObj: Index; draggedEl: HTMLElement };
type DraggedLeftDetail = { draggedEl: HTMLElement; type: string; theOtherDz?: HTMLElement };
// The mouse and touch handlers are shared, and tell a touch event by its touches
type MouseOrTouchEvent = MouseEvent | TouchEvent;
type Timeout = ReturnType<typeof setTimeoutIn>;

const DEFAULT_DROP_ZONE_TYPE = "--any--";
const MIN_OBSERVATION_INTERVAL_MS = 100;
const DISABLED_OBSERVATION_INTERVAL_MS = 20;
const MIN_MOVEMENT_BEFORE_DRAG_START_PX = 3;
const DEFAULT_TOUCH_DELAY_MS = 80;
const DEFAULT_DROP_TARGET_STYLE = {
    outline: "rgba(255, 255, 102, 0.7) solid 2px",
};
const ORIGINAL_DRAGGED_ITEM_MARKER_ATTRIBUTE = "data-is-dnd-original-dragged-item";

let originalDragTarget: HTMLElement | undefined;
let draggedEl: HTMLElement | undefined;
let draggedElData: Item | undefined;
let draggedElType: string | undefined;
let originDropZone: HTMLElement | undefined;
let originIndex: number | undefined;
let shadowElData: Item | undefined;
let shadowElDropZone: HTMLElement | undefined;
let dragStartMousePosition: Point | undefined;
let currentMousePosition: Point | undefined;
let isWorkingOnPreviousDrag = false;
let finalizingPreviousDrag = false;
let unlockOriginDzMinDimensions: (() => void) | undefined;
let isDraggedOutsideOfAnyDz = false;
let scheduledForRemovalAfterDrop: { dz: HTMLElement; destroy: () => void }[] = [];
let multiScroller: MultiScroller | undefined;
let touchDragHoldTimer: Timeout | undefined;
let touchHoldElapsed = false;
let useCursorForDetectionActive = false;
let pendingDragOwner: HTMLElement | undefined;
let watchedDropZones = new Set<HTMLElement>();
// The window of the drag in progress: the dragged item's own window, which is not the one that
// loaded this module when the zone lives in a same-origin iframe or a popup.
let dragWindow: WindowWithGlobals | undefined;
// While the drop animation runs: its timeout and the function that finalizes the drop
let dropFinalization: { timeout: Timeout; finalize: () => void } | undefined;

// a map from type to a set of drop-zones
const typeToDropZones = new Map<string, Set<HTMLElement>>();
// important - this is needed because otherwise the config that would be used for everyone is the config of the element that created the event listeners
const dzToConfig = new Map<HTMLElement, Config>();
// this is needed in order to be able to cleanup old listeners and avoid stale closures issues (as the listener is defined within each zone)
const elToMouseDownListener = new WeakMap<Element, (e: MouseOrTouchEvent) => void>();

/* drop-zones registration management */
function registerDropZone(dropZoneEl: HTMLElement, type: string): void {
    printDebug(() => "registering drop-zone if absent");
    if (!typeToDropZones.has(type)) {
        typeToDropZones.set(type, new Set());
    }
    // the set for type was added just above if it was missing
    if (!typeToDropZones.get(type)!.has(dropZoneEl)) {
        typeToDropZones.get(type)!.add(dropZoneEl);
        incrementActiveDropZoneCount();
    }
}
function unregisterDropZone(dropZoneEl: HTMLElement, type: string): void {
    const dropZones = typeToDropZones.get(type);
    if (!dropZones || !dropZones.delete(dropZoneEl)) return;
    decrementActiveDropZoneCount();
    if (dropZones.size === 0) {
        typeToDropZones.delete(type);
    }
}
// The pointer is only tracked in the drag's window and each window has its own coordinates, so zones in other windows
// are not candidates, and neither are zones whose window is gone
function getDropZonesInDragWindow(type: string): HTMLElement[] {
    return Array.from(typeToDropZones.get(type) || []).filter((dz) => dz.ownerDocument.defaultView === dragWindow);
}

/* functions to manage observing the dragged element and trigger custom drag-events */
function watchDraggedElement(): void {
    printDebug(() => "watching dragged element");
    // draggedElType and draggedEl are set in handleDragStart and dragWindow in handleMouseDown, for the whole drag
    const dropZones = getDropZonesInDragWindow(draggedElType!);
    if (dropZones.length === 0) return;
    if (watchedDropZones.size > 0) unWatchDraggedElement();
    watchedDropZones = new Set(dropZones);

    // the handlers take the CustomEvents that helpers/dispatcher dispatches on the zones
    for (const dz of watchedDropZones) {
        dz.addEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered as EventListener);
        dz.addEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft as EventListener);
        dz.addEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex as EventListener);
    }
    dragWindow!.addEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);

    // it is important that we don't have an interval that is faster than the flip duration because it can cause elements to jump bach and forth
    // every watched zone is registered, so it has a config
    const setIntervalMs = Math.max(
        ...Array.from(watchedDropZones).map((dz) => dzToConfig.get(dz)!.dropAnimationDurationMs),
    );
    const observationIntervalMs =
        setIntervalMs === 0 ? DISABLED_OBSERVATION_INTERVAL_MS : Math.max(setIntervalMs, MIN_OBSERVATION_INTERVAL_MS); // if setIntervalMs is 0 it goes to 20, otherwise it is max between it and min observation.
    multiScroller = createMultiScroller(watchedDropZones, () => currentMousePosition);
    // Returns reference point in document coordinates - either cursor position or element center
    // currentMousePosition is set from the mousedown on for the whole drag
    const getReferencePoint = useCursorForDetectionActive
        ? () => ({
              x: currentMousePosition!.x + dragWindow!.scrollX,
              y: currentMousePosition!.y + dragWindow!.scrollY,
          })
        : () => findCenterOfElement(draggedEl!);
    observe(draggedEl!, watchedDropZones, observationIntervalMs * 1.07, multiScroller, getReferencePoint);
}
function unWatchDraggedElement(): void {
    printDebug(() => "unwatching dragged element");
    // the same handlers that watchDraggedElement added
    for (const dz of watchedDropZones) {
        dz.removeEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered as EventListener);
        dz.removeEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft as EventListener);
        dz.removeEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex as EventListener);
    }
    watchedDropZones = new Set();
    // dragWindow is set in handleMouseDown for the whole drag
    dragWindow!.removeEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
    // ensuring multiScroller is not already destroyed before destroying
    if (multiScroller) {
        multiScroller.destroy();
        multiScroller = undefined;
    }
    unobserve();
}

function findShadowElementIdx(items: Item[]): number {
    return items.findIndex((item) => !!item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
}
function createShadowElData(draggedElData: Item): Item {
    return { ...draggedElData, [SHADOW_ITEM_MARKER_PROPERTY_NAME]: true, [ITEM_ID_KEY]: SHADOW_PLACEHOLDER_ITEM_ID };
}

/* custom drag-events handlers */
function handleDraggedEntered(e: DropZoneEvent<DraggedOverDetail>): void {
    printDebug(() => ["dragged entered", e.currentTarget, e.detail]);
    const config = dzToConfig.get(e.currentTarget);
    // a zone nested in the dragged item is destroyed at once, even mid-drag, and stays watched (#5)
    if (!config) return;
    // the drag globals are set from handleMouseDown and handleDragStart for the whole drag
    let { items, dropFromOthersDisabled } = config;
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "ignoring dragged entered because drop is currently disabled");
        return;
    }
    isDraggedOutsideOfAnyDz = false;
    // this deals with another race condition. on some occasions (super rapid operations) the list hasn't updated yet
    items = items.filter(
        (item) => item[ITEM_ID_KEY] !== shadowElData![ITEM_ID_KEY] && item[ITEM_ID_KEY] !== SHADOW_PLACEHOLDER_ITEM_ID,
    );
    printDebug(() => `dragged entered items ${toString(items)}`);

    if (originDropZone !== e.currentTarget) {
        const originZoneItems = dzToConfig.get(originDropZone!)!.items;
        const newOriginZoneItems = originZoneItems.filter((item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
        dispatchConsiderEvent(originDropZone!, newOriginZoneItems, {
            trigger: TRIGGERS.DRAGGED_ENTERED_ANOTHER,
            id: draggedElData![ITEM_ID_KEY],
            source: SOURCES.POINTER,
        });
        // the handler can end the drag, for example by removing its window
        if (!isWorkingOnPreviousDrag) return;
    }
    const { index: shadowElIdx } = e.detail.indexObj;
    shadowElDropZone = e.currentTarget;
    items.splice(shadowElIdx, 0, shadowElData!);
    dispatchConsiderEvent(e.currentTarget, items, {
        trigger: TRIGGERS.DRAGGED_ENTERED,
        id: draggedElData![ITEM_ID_KEY],
        source: SOURCES.POINTER,
    });
}

function handleDraggedLeft(e: DropZoneEvent<DraggedLeftDetail>): void {
    // dealing with a rare race condition on extremely rapid clicking and dropping
    if (!isWorkingOnPreviousDrag) return;
    printDebug(() => ["dragged left", e.currentTarget, e.detail]);
    // the drag globals are set from handleMouseDown and handleDragStart for the whole drag
    // a zone nested in the dragged item is destroyed at once, even mid-drag, and stays watched (#5).
    // Only a destroyed zone that holds the shadow element has to hand it over, as an empty zone that gets no events.
    const config = dzToConfig.get(e.currentTarget);
    if (!config && shadowElDropZone !== e.currentTarget) return;
    const { items: originalItems, dropFromOthersDisabled } = config ?? { items: [], dropFromOthersDisabled: false };
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone && e.currentTarget !== shadowElDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    const items = [...originalItems];
    const shadowElIdx = findShadowElementIdx(items);
    if (shadowElIdx !== -1) {
        items.splice(shadowElIdx, 1);
    }
    const origShadowDz = shadowElDropZone;
    shadowElDropZone = undefined;
    const { type, theOtherDz } = e.detail;
    if (
        type === DRAGGED_LEFT_TYPES.OUTSIDE_OF_ANY ||
        (type === DRAGGED_LEFT_TYPES.LEFT_FOR_ANOTHER &&
            theOtherDz !== originDropZone &&
            // a LEFT_FOR_ANOTHER event carries theOtherDz, a watched zone. A destroyed one (#5) takes no drop.
            (dzToConfig.get(theOtherDz!)?.dropFromOthersDisabled ?? true))
    ) {
        printDebug(() => "dragged left all, putting shadow element back in the origin dz");
        isDraggedOutsideOfAnyDz = true;
        shadowElDropZone = originDropZone;
        // if the last zone it left is the origin dz, we will put it back into items (which we just removed it from)
        const originZoneItems = origShadowDz === originDropZone ? items : [...dzToConfig.get(originDropZone!)!.items];
        originZoneItems.splice(originIndex!, 0, shadowElData!);
        dispatchConsiderEvent(originDropZone!, originZoneItems, {
            trigger: TRIGGERS.DRAGGED_LEFT_ALL,
            id: draggedElData![ITEM_ID_KEY],
            source: SOURCES.POINTER,
        });
        // the handler can end the drag, for example by removing its window
        if (!isWorkingOnPreviousDrag) return;
    }
    if (!config) return;
    // for the origin dz, when the dragged is outside of any, this will be fired in addition to the previous. this is for simplicity
    dispatchConsiderEvent(e.currentTarget, items, {
        trigger: TRIGGERS.DRAGGED_LEFT,
        id: draggedElData![ITEM_ID_KEY],
        source: SOURCES.POINTER,
    });
}
function handleDraggedIsOverIndex(e: DropZoneEvent<DraggedOverDetail>): void {
    printDebug(() => ["dragged is over index", e.currentTarget, e.detail]);
    const config = dzToConfig.get(e.currentTarget);
    // a zone nested in the dragged item is destroyed at once, even mid-drag, and stays watched (#5)
    if (!config) return;
    // the drag globals are set from handleMouseDown and handleDragStart for the whole drag
    const { items: originalItems, dropFromOthersDisabled } = config;
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    const items = [...originalItems];
    isDraggedOutsideOfAnyDz = false;
    const { index } = e.detail.indexObj;
    const shadowElIdx = findShadowElementIdx(items);
    if (shadowElIdx !== -1) {
        items.splice(shadowElIdx, 1);
    }
    items.splice(index, 0, shadowElData!);
    dispatchConsiderEvent(e.currentTarget, items, {
        trigger: TRIGGERS.DRAGGED_OVER_INDEX,
        id: draggedElData![ITEM_ID_KEY],
        source: SOURCES.POINTER,
    });
}

// Global mouse/touch-events handlers
function handleMouseMove(e: MouseOrTouchEvent): void {
    e.preventDefault();
    // only a touch event has touches
    const c = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    currentMousePosition = { x: c.clientX, y: c.clientY };
    // draggedEl and dragStartMousePosition are set before this listener is added, for the whole drag
    draggedEl!.style.transform = `translate3d(${currentMousePosition.x - dragStartMousePosition!.x}px, ${
        currentMousePosition.y - dragStartMousePosition!.y
    }px, 0)`;
}

function handleDrop(): void {
    printDebug(() => "dropped");
    finalizingPreviousDrag = true;
    // cleanup
    // the drag globals are set from handleMouseDown and handleDragStart for the whole drag
    dragWindow!.removeEventListener("mousemove", handleMouseMove);
    dragWindow!.removeEventListener("touchmove", handleMouseMove);
    dragWindow!.removeEventListener("mouseup", handleDrop);
    dragWindow!.removeEventListener("touchend", handleDrop);
    unWatchDraggedElement();
    moveDraggedElementToWasDroppedState(draggedEl!);

    if (!shadowElDropZone) {
        printDebug(() => "element was dropped right after it left origin but before entering somewhere else");
        shadowElDropZone = originDropZone;
    }
    // the shadow element was in a zone nested in the dragged item, which was destroyed mid-drag (#5):
    // the item goes back to where it came from, like a drop outside of any zone
    const isShadowElDropZoneDestroyed = !dzToConfig.has(shadowElDropZone!);
    if (isShadowElDropZoneDestroyed) {
        printDebug(() => "the zone the element was dropped in was destroyed, dropping it back into its origin");
        shadowElDropZone = originDropZone;
        isDraggedOutsideOfAnyDz = true;
    }
    printDebug(() => ["dropped in dz", shadowElDropZone]);
    // shadowElDropZone is a registered zone now
    let { items, type } = dzToConfig.get(shadowElDropZone!)!;
    if (isShadowElDropZoneDestroyed && findShadowElementIdx(items) === -1) {
        items = [...items];
        items.splice(originIndex!, 0, shadowElData!);
    }
    styleInactiveDropZones(
        getDropZonesInDragWindow(type),
        (dz) => dzToConfig.get(dz)!.dropTargetStyle,
        (dz) => dzToConfig.get(dz)!.dropTargetClasses,
    );
    let shadowElIdx = findShadowElementIdx(items);
    // the handler might remove the shadow element, ex: dragula like copy on drag
    if (shadowElIdx === -1) {
        if (shadowElDropZone === originDropZone) {
            shadowElIdx = originIndex!;
        }
    }

    items = items.map((item) => (item[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? draggedElData! : item));
    function finalizeWithinZone(): void {
        // The original-element rAF loop may have re-armed observation during the settle animation.
        // Cancel again before dispatching events that can update or destroy drop zones.
        unWatchDraggedElement();
        // the drag globals are still set: cleanupPostDrop clears them at the end of this function
        unlockOriginDzMinDimensions!();
        dispatchFinalizeEvent(shadowElDropZone!, items, {
            trigger: isDraggedOutsideOfAnyDz ? TRIGGERS.DROPPED_OUTSIDE_OF_ANY : TRIGGERS.DROPPED_INTO_ZONE,
            id: draggedElData![ITEM_ID_KEY],
            source: SOURCES.POINTER,
        });
        if (shadowElDropZone !== originDropZone) {
            // letting the origin drop zone know the element was permanently taken away
            dispatchFinalizeEvent(originDropZone!, dzToConfig.get(originDropZone!)!.items, {
                trigger: TRIGGERS.DROPPED_INTO_ANOTHER,
                id: draggedElData![ITEM_ID_KEY],
                source: SOURCES.POINTER,
            });
        }
        // In edge cases the dom might have not been updated yet so we can't rely on data list index
        const domShadowEl = Array.from(shadowElDropZone!.children).find((c) =>
            c.getAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME),
        );
        // the zone's children are the rendered items, HTML elements
        if (domShadowEl) unDecorateShadowElement(domShadowEl as HTMLElement);
        cleanupPostDrop();
    }
    if (dzToConfig.get(shadowElDropZone!)!.dropAnimationDisabled) {
        finalizeWithinZone();
    } else {
        // the origin zone has not rendered the shadow element put back above, so animate to the zone itself
        animateDraggedToFinalPosition(isShadowElDropZoneDestroyed ? -1 : shadowElIdx, finalizeWithinZone);
    }
}

// helper function for handleDrop
function animateDraggedToFinalPosition(shadowElIdx: number, callback: () => void): void {
    // handleDrop sets shadowElDropZone, a registered zone, and the drag globals are set for the whole drag.
    // The zone's children are the rendered items, HTML elements.
    const shadowElRect =
        shadowElIdx > -1
            ? getBoundingRectNoTransforms(shadowElDropZone!.children[shadowElIdx] as HTMLElement, false)
            : getBoundingRectNoTransforms(shadowElDropZone!, false);
    const newTransform = {
        x: shadowElRect.left - parseFloat(draggedEl!.style.left),
        y: shadowElRect.top - parseFloat(draggedEl!.style.top),
    };
    const { dropAnimationDurationMs } = dzToConfig.get(shadowElDropZone!)!;
    const transition = `transform ${dropAnimationDurationMs}ms ease`;
    draggedEl!.style.transition = draggedEl!.style.transition
        ? draggedEl!.style.transition + "," + transition
        : transition;
    draggedEl!.style.transform = `translate3d(${newTransform.x}px, ${newTransform.y}px, 0)`;
    dropFinalization = {
        timeout: setTimeoutIn(dragWindow!, finishDropAnimation, dropAnimationDurationMs),
        finalize: callback,
    };
}
function finishDropAnimation(): void {
    // only called by the timeout that animateDraggedToFinalPosition stores with it, or after checking it is set
    const { finalize } = dropFinalization!;
    // cleared first, because a finalize handler can remove the drag's window
    dropFinalization = undefined;
    finalize();
}

// The drag's window is going away: it was closed or navigated, or its iframe was removed. Its events, timers and animation
// frames stop, so finish the drag now, without the drop animation, and let the other windows start new drags.
function handleDragWindowHidden(): void {
    printDebug(() => "the drag's window is going away");
    if (!finalizingPreviousDrag) {
        handleDrop();
    }
    if (dropFinalization) {
        clearTimeoutIn(dropFinalization.timeout);
        finishDropAnimation();
    }
}

function scheduleDZForRemovalAfterDrop(dz: HTMLElement, destroy: () => void): void {
    const scheduledRemoval = { dz, destroy };
    scheduledForRemovalAfterDrop.push(scheduledRemoval);
    getWindowOf(dz).requestAnimationFrame(() => {
        if (!scheduledForRemovalAfterDrop.includes(scheduledRemoval)) return;
        hideElement(dz);
        dz.ownerDocument.body.appendChild(dz);
    });
}
/* cleanup */
function cleanupPostDrop(): void {
    // Remove the temporary elements that were kept in the DOM during the drag
    if (draggedEl && draggedEl.remove) {
        draggedEl.remove();
    }
    if (originalDragTarget && originalDragTarget.remove) {
        originalDragTarget.remove();
    }

    draggedEl = undefined;
    originalDragTarget = undefined;
    draggedElData = undefined;
    draggedElType = undefined;
    originDropZone = undefined;
    originIndex = undefined;
    shadowElData = undefined;
    shadowElDropZone = undefined;
    dragStartMousePosition = undefined;
    currentMousePosition = undefined;
    isWorkingOnPreviousDrag = false;
    finalizingPreviousDrag = false;
    unlockOriginDzMinDimensions = undefined;
    isDraggedOutsideOfAnyDz = false;
    // runs at the end of a drop, while dragWindow is still set
    dragWindow!.removeEventListener("pagehide", handleDragWindowHidden);
    dragWindow = undefined;
    clearTimeoutIn(touchDragHoldTimer);
    touchDragHoldTimer = undefined;
    touchHoldElapsed = false;
    useCursorForDetectionActive = false;
    pendingDragOwner = undefined;
    if (scheduledForRemovalAfterDrop.length) {
        printDebug(() => ["will destroy zones that were removed during drag", scheduledForRemovalAfterDrop]);
        scheduledForRemovalAfterDrop.forEach(({ dz, destroy }) => {
            destroy();
            dz.remove();
        });
        scheduledForRemovalAfterDrop = [];
    }
}

export function dndzone<T extends Item>(
    node: HTMLElement,
    options: Options<T>,
): { update(newOptions: Options<T>): void; destroy(): void } {
    let initialized = false;
    let destroyed = false;
    // configure(options) below sets items, type and dropAnimationDurationMs. Before that only the debug print reads them,
    // and the first configure call, which checks config.type before setting it.
    const config = {
        items: undefined,
        type: undefined,
        flipDurationMs: 0,
        dragDisabled: false,
        morphDisabled: false,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses: [],
        transformDraggedElement: () => {},
        centreDraggedOnCursor: false,
        useCursorForDetection: false,
        dropAnimationDisabled: false,
        delayTouchStartMs: 0,
    } as unknown as Config;
    printDebug(() => [`dndzone good to go options: ${toString(options)}, config: ${toString(config)}`, { node }]);
    let elToIdx = new Map<HTMLElement, number>();

    // dragWindow is set in handleMouseDown before the pending gesture starts, and stays set while this zone owns it
    function addMaybeListeners(): void {
        dragWindow!.addEventListener("mousemove", handleMouseMoveMaybeDragStart, { passive: false });
        dragWindow!.addEventListener("touchmove", handleMouseMoveMaybeDragStart, { passive: false, capture: false });
        dragWindow!.addEventListener("mouseup", handleFalseAlarm, { passive: false });
        dragWindow!.addEventListener("touchend", handleFalseAlarm, { passive: false });
        dragWindow!.addEventListener("pagehide", cancelPendingDrag);
    }
    function removeMaybeListeners(): void {
        dragWindow!.removeEventListener("mousemove", handleMouseMoveMaybeDragStart);
        dragWindow!.removeEventListener("touchmove", handleMouseMoveMaybeDragStart);
        dragWindow!.removeEventListener("mouseup", handleFalseAlarm);
        dragWindow!.removeEventListener("touchend", handleFalseAlarm);
        dragWindow!.removeEventListener("pagehide", cancelPendingDrag);
        if (touchDragHoldTimer) {
            clearTimeoutIn(touchDragHoldTimer);
            touchDragHoldTimer = undefined;
            touchHoldElapsed = false;
        }
    }
    function cancelPendingDrag(): void {
        if (pendingDragOwner !== node) return;
        removeMaybeListeners();
        dragWindow = undefined;
        pendingDragOwner = undefined;
        originalDragTarget = undefined;
        dragStartMousePosition = undefined;
        currentMousePosition = undefined;
    }
    function handleFalseAlarm(e: MouseOrTouchEvent): void {
        if (pendingDragOwner !== node) return;
        cancelPendingDrag();

        // dragging initiated by touch events prevents onclick from initially firing
        if (e.type === "touchend") {
            // a touchend targets the element the touch started on
            const clickEvent = new (getWindowOf(e.target as Element).Event)("click", {
                bubbles: true,
                cancelable: true,
            });
            // doing it this way instead of calling .click() because that doesn't work for SVG elements
            (e.target as Element).dispatchEvent(clickEvent);
        }
    }

    function handleMouseMoveMaybeDragStart(e: MouseOrTouchEvent): void {
        if (destroyed || pendingDragOwner !== node) return;
        // only a touch event has touches
        const isTouch = !!(e as TouchEvent).touches;
        const c = isTouch ? (e as TouchEvent).touches[0] : (e as MouseEvent);
        // If touch drag delay is configured and not elapsed yet, allow scrolling until either
        // the delay elapses (timer will call handleDragStart) or the user moves significantly,
        // in which case we cancel the potential drag and let the interaction be a scroll.
        // dragStartMousePosition is set in handleMouseDown with the pending gesture
        if (isTouch && config.delayTouchStartMs > 0 && !touchHoldElapsed) {
            currentMousePosition = { x: c.clientX, y: c.clientY };
            if (
                Math.abs(currentMousePosition.x - dragStartMousePosition!.x) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX ||
                Math.abs(currentMousePosition.y - dragStartMousePosition!.y) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX
            ) {
                // User started scrolling, cancel drag attempt.
                clearTimeoutIn(touchDragHoldTimer);
                touchDragHoldTimer = undefined;
                handleFalseAlarm(e);
            }
            return; // Do not preventDefault so scrolling works.
        }

        // legacy / post-delay path – block scrolling and maybe start drag
        e.preventDefault();

        currentMousePosition = { x: c.clientX, y: c.clientY };
        if (
            Math.abs(currentMousePosition.x - dragStartMousePosition!.x) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX ||
            Math.abs(currentMousePosition.y - dragStartMousePosition!.y) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX
        ) {
            handleDragStart();
        }
    }
    function handleMouseDown(e: MouseOrTouchEvent): void {
        // on safari clicking on a select element doesn't fire mouseup at the end of the click and in general this makes more sense
        // the target is an element inside the draggable, value is only set on form controls
        if (
            e.target !== e.currentTarget &&
            ((e.target as HTMLElement & { value?: unknown }).value !== undefined ||
                (e.target as HTMLElement).isContentEditable)
        ) {
            printDebug(() => "won't initiate drag on a nested input element");
            return;
        }
        // prevents responding to any button but left click which equals 0 (which is falsy)
        // a touch event has no button, which reads as undefined (falsy)
        if ((e as MouseEvent).button) {
            printDebug(() => `ignoring none left click button: ${(e as MouseEvent).button}`);
            return;
        }
        if (destroyed || isWorkingOnPreviousDrag || pendingDragOwner) {
            printDebug(() => "cannot start a new drag before finalizing the current drag or pending gesture");
            return;
        }
        // only a touch event has touches
        const isTouchStart = !!(e as TouchEvent).touches;
        const useDelay = isTouchStart && config.delayTouchStartMs > 0;

        if (!useDelay) {
            e.preventDefault();
        }
        e.stopPropagation();
        pendingDragOwner = node;

        const c = isTouchStart ? (e as TouchEvent).touches[0] : (e as MouseEvent);
        dragStartMousePosition = { x: c.clientX, y: c.clientY };
        currentMousePosition = { ...dragStartMousePosition };
        // the listener is on a draggable, one of the zone's children
        originalDragTarget = e.currentTarget as HTMLElement;
        dragWindow = getWindowOf(originalDragTarget);

        if (useDelay) {
            const pendingTarget = originalDragTarget;
            touchHoldElapsed = false;
            touchDragHoldTimer = setTimeoutIn(
                dragWindow,
                () => {
                    // If this action still owns the same pending gesture, transition it to a drag.
                    if (destroyed || pendingDragOwner !== node || originalDragTarget !== pendingTarget) return;
                    touchHoldElapsed = true;
                    handleDragStart();
                },
                config.delayTouchStartMs,
            );
        }

        addMaybeListeners();
    }

    function handleDragStart(): void {
        if (destroyed || pendingDragOwner !== node || isWorkingOnPreviousDrag || !originalDragTarget?.parentElement) {
            cancelPendingDrag();
            return;
        }
        removeMaybeListeners();
        pendingDragOwner = undefined;
        printDebug(() => [`drag start config: ${toString(config)}`, originalDragTarget]);
        isWorkingOnPreviousDrag = true;

        // initialising globals
        // configure indexed every draggable that has the mousedown listener
        const currentIdx = elToIdx.get(originalDragTarget)!;
        originIndex = currentIdx;
        originDropZone = originalDragTarget.parentElement;
        // the root is a dialog or popover element, a shadow root, or the document, and only the document has a body
        const rootNode = (originDropZone.closest("dialog") ||
            originDropZone.closest("[popover]") ||
            originDropZone.getRootNode()) as (ShadowRoot | Document | Element) & { body?: HTMLElement };
        const originDropZoneRoot = rootNode.body || rootNode;
        const { items: originalItems, type, centreDraggedOnCursor, useCursorForDetection } = config;
        const items = [...originalItems];
        draggedElData = items[currentIdx];
        draggedElType = type;
        shadowElData = createShadowElData(draggedElData);
        useCursorForDetectionActive = useCursorForDetection;

        // creating the draggable element
        // false when not centring, which createDraggedElementFrom treats like undefined
        draggedEl = createDraggedElementFrom(
            originalDragTarget,
            (centreDraggedOnCursor && currentMousePosition) as Point | undefined,
            config.useComputedStyleForRects,
        );
        originDropZoneRoot.appendChild(draggedEl);
        // We will keep the original dom node in the dom because touch events keep firing on it, we want to re-add it after the framework removes it
        function keepOriginalElementInDom(): void {
            // Once the drop starts finalizing, handleDrop has stopped observation and this loop
            // must not re-arm it during the settle animation. After cleanup, draggedEl is cleared
            // as an additional guard against the original element leaving the DOM much later.
            if (!draggedEl || finalizingPreviousDrag) return;
            // draggedEl is set, so the drag globals are too: cleanupPostDrop clears them together
            if (!originalDragTarget!.parentElement) {
                // @ts-expect-error -- setAttribute stringifies the value, so true sets "true"
                originalDragTarget!.setAttribute(ORIGINAL_DRAGGED_ITEM_MARKER_ATTRIBUTE, true);
                originDropZoneRoot.appendChild(originalDragTarget!);
                // have to watch before we hide, otherwise Svelte 5 $state gets confused
                watchDraggedElement();
                // a consider handler during the first observation can end the drag, for example by removing its window
                if (!draggedEl) return;
                hideElement(originalDragTarget!);
                // after the removal of the original element we can give the shadow element the original item id so that the host zone can find it and render it correctly if it does lookups by id
                shadowElData![ITEM_ID_KEY] = draggedElData![ITEM_ID_KEY];
                // to prevent the outline from disappearing
                draggedEl.focus();
            } else {
                dragWindow!.requestAnimationFrame(keepOriginalElementInDom);
            }
        }
        // dragWindow is set in handleMouseDown and stays set for the whole drag
        dragWindow!.requestAnimationFrame(keepOriginalElementInDom);

        // the active zones are registered, so they have a config
        styleActiveDropZones(
            getDropZonesInDragWindow(config.type).filter(
                (dz) => dz === originDropZone || !dzToConfig.get(dz)!.dropFromOthersDisabled,
            ),
            (dz) => dzToConfig.get(dz)!.dropTargetStyle,
            (dz) => dzToConfig.get(dz)!.dropTargetClasses,
        );

        // removing the original element by removing its data entry
        items.splice(currentIdx, 1, shadowElData);
        unlockOriginDzMinDimensions = preventShrinking(originDropZone);

        // handing over to global handlers - starting to watch the element. This happens before the consider event because
        // its handler can remove the drag's window, which ends the drag.
        dragWindow!.addEventListener("mousemove", handleMouseMove, { passive: false });
        dragWindow!.addEventListener("touchmove", handleMouseMove, { passive: false, capture: false });
        dragWindow!.addEventListener("mouseup", handleDrop, { passive: false });
        dragWindow!.addEventListener("touchend", handleDrop, { passive: false });
        dragWindow!.addEventListener("pagehide", handleDragWindowHidden);

        dispatchConsiderEvent(originDropZone, items, {
            trigger: TRIGGERS.DRAG_STARTED,
            id: draggedElData[ITEM_ID_KEY],
            source: SOURCES.POINTER,
        });
    }

    function configure({
        // @ts-expect-error -- items is required, and this no-op default leaves a missing items undefined
        items = undefined,
        flipDurationMs: dropAnimationDurationMs = 0,
        type: newType = DEFAULT_DROP_ZONE_TYPE,
        dragDisabled = false,
        morphDisabled = false,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses = [],
        transformDraggedElement = () => {},
        centreDraggedOnCursor = false,
        useCursorForDetection = false,
        dropAnimationDisabled = false,
        useComputedStyleForRects = false,
        delayTouchStart: delayTouchStartOpt = false,
        onconsider,
        onfinalize,
    }: Options<T>): void {
        // A torn-down zone gets no callbacks, even if it is configured once more.
        // The engine passes items through untouched, so a zone's items are its own T.
        if (!destroyed) registerZoneCallbacks(node, { onconsider, onfinalize } as ZoneCallbacks);
        const isInDragWindow = isWorkingOnPreviousDrag && node.ownerDocument.defaultView === dragWindow;
        const wasDropTarget =
            node === originDropZone || (config.type === draggedElType && !config.dropFromOthersDisabled);
        const isDropTarget = node === originDropZone || (newType === draggedElType && !dropFromOthersDisabled);
        config.dropAnimationDurationMs = dropAnimationDurationMs;

        let effectiveDelayMs = 0;
        if (delayTouchStartOpt === true) {
            effectiveDelayMs = DEFAULT_TOUCH_DELAY_MS;
        } else if (typeof delayTouchStartOpt === "number" && isFinite(delayTouchStartOpt) && delayTouchStartOpt >= 0) {
            effectiveDelayMs = delayTouchStartOpt;
        }
        config.delayTouchStartMs = effectiveDelayMs;

        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.morphDisabled = morphDisabled;
        config.transformDraggedElement = transformDraggedElement;
        config.centreDraggedOnCursor = centreDraggedOnCursor;
        config.useCursorForDetection = useCursorForDetection;
        config.dropAnimationDisabled = dropAnimationDisabled;
        config.useComputedStyleForRects = useComputedStyleForRects;

        // Realtime styling follows the same eligibility as drag start. Remove the previously applied styles and
        // classes before storing the new options, including when disabling incoming drops and changing styles together.
        if (
            initialized &&
            isInDragWindow &&
            !finalizingPreviousDrag &&
            (wasDropTarget !== isDropTarget ||
                !areObjectsShallowEqual(dropTargetStyle, config.dropTargetStyle) ||
                !areArraysShallowEqualSameOrder(dropTargetClasses, config.dropTargetClasses))
        ) {
            if (wasDropTarget) {
                styleInactiveDropZones(
                    [node],
                    () => config.dropTargetStyle,
                    () => config.dropTargetClasses,
                );
            }
            if (isDropTarget) {
                styleActiveDropZones(
                    [node],
                    () => dropTargetStyle,
                    () => dropTargetClasses,
                );
            }
        }
        config.dropTargetStyle = dropTargetStyle;
        config.dropTargetClasses = [...dropTargetClasses];
        config.dropFromOthersDisabled = dropFromOthersDisabled;

        dzToConfig.set(node, config);
        registerDropZone(node, newType);
        const shadowElIdx = isWorkingOnPreviousDrag ? findShadowElementIdx(config.items) : -1;
        for (let idx = 0; idx < node.children.length; idx++) {
            // the zone's children are the rendered items, HTML elements
            const draggableEl = node.children[idx] as HTMLElement;
            styleDraggable(draggableEl, dragDisabled);
            if (idx === shadowElIdx) {
                // a shadow item is only in the items during a drag, while draggedEl and currentMousePosition are set
                if (!morphDisabled) {
                    morphDraggedElementToBeLike(
                        draggedEl!,
                        draggableEl,
                        currentMousePosition!.x,
                        currentMousePosition!.y,
                        config.useComputedStyleForRects,
                    );
                }
                config.transformDraggedElement(draggedEl, draggedElData, idx);
                decorateShadowEl(draggableEl);
                continue;
            }
            // removeEventListener ignores undefined, which it gets for a child without a listener yet
            draggableEl.removeEventListener("mousedown", elToMouseDownListener.get(draggableEl) as EventListener);
            draggableEl.removeEventListener("touchstart", elToMouseDownListener.get(draggableEl) as EventListener);
            if (!dragDisabled) {
                draggableEl.addEventListener("mousedown", handleMouseDown);
                draggableEl.addEventListener("touchstart", handleMouseDown);
                elToMouseDownListener.set(draggableEl, handleMouseDown);
            }
            // updating the idx
            elToIdx.set(draggableEl, idx);
        }
        // Empty zones are initialized too: they can receive active-target styling before they have any children.
        initialized = true;
    }
    configure(options);

    return {
        update: (newOptions: Options<T>) => {
            printDebug(() => `pointer dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            // a zone kept until the drop ends (scheduled for removal, or the origin of a drop into another) gets no callbacks
            unregisterZoneCallbacks(node);
            cancelPendingDrag();
            // the zone's children are the rendered items, HTML elements.
            // removeEventListener ignores undefined, which it gets for a child without a listener.
            for (const draggableEl of node.children as HTMLCollectionOf<HTMLElement>) {
                draggableEl.removeEventListener("mousedown", elToMouseDownListener.get(draggableEl) as EventListener);
                draggableEl.removeEventListener("touchstart", elToMouseDownListener.get(draggableEl) as EventListener);
            }
            function destroyDz(): void {
                printDebug(() => "pointer dndzone will destroy");
                const registeredConfig = dzToConfig.get(node);
                if (!registeredConfig) return;
                unregisterDropZone(node, registeredConfig.type);
                dzToConfig.delete(node);
            }
            if (isWorkingOnPreviousDrag && !node.closest(`[${ORIGINAL_DRAGGED_ITEM_MARKER_ATTRIBUTE}]`)) {
                printDebug(() => "pointer dndzone will be scheduled for destruction");
                scheduleDZForRemovalAfterDrop(node, destroyDz);
            } else {
                destroyDz();
            }
        },
    };
}
