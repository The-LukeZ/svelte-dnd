import {
    decrementActiveDropZoneCount,
    incrementActiveDropZoneCount,
    ITEM_ID_KEY,
    SOURCES,
    TRIGGERS,
} from "./constants";
import { isKeyboardDragTriggerKey } from "./keyboardDragTrigger";
import { styleActiveDropZones, styleInactiveDropZones } from "./helpers/styler";
import {
    dispatchConsiderEvent,
    dispatchFinalizeEvent,
    registerZoneCallbacks,
    unregisterZoneCallbacks,
} from "./helpers/dispatcher";
import { initAria, announceToScreenReader, destroyAria } from "./helpers/aria";
import { getWindowOf, toString } from "./helpers/util";
import { printDebug } from "./constants";
import type { DndEvent, Item, Options } from "./types";

// The config of a zone
type Config = {
    items: Item[];
    type: string;
    dragDisabled: boolean;
    zoneTabIndex: number;
    zoneItemTabIndex: number;
    dropFromOthersDisabled: boolean;
    dropTargetStyle: Record<string, string>;
    dropTargetClasses: string[];
    autoAriaDisabled: boolean;
    // kept so that triggerAllDzsUpdate, which configures a zone from its config, keeps the zone's callbacks
    onconsider?: (e: DndEvent) => void;
    onfinalize?: (e: DndEvent) => void;
};
// The global handlers that a document registration added to its window, by event type
type Registration = {
    win: Window | null;
    zoneCount: number;
    documentCount: number;
    handlers: Record<string, EventListener>;
};

const DEFAULT_DROP_ZONE_TYPE = "--any--";
const DEFAULT_DROP_TARGET_STYLE = {
    outline: "rgba(255, 255, 102, 0.7) solid 2px",
};

let isDragging = false;
let draggedItemType: string | null | undefined;
let focusedDz: HTMLElement | null | undefined;
let focusedDzLabel = "";
let focusedItem: HTMLElement | null | undefined;
let focusedItemId: unknown;
let focusedItemLabel = "";
// Like pointer dragging, a keyboard drag only has destinations in the document it started in.
let dragDocument: Document | undefined;
const allDragTargets = new WeakSet<Element>();
const elToKeyDownListeners = new WeakMap<Element, (e: KeyboardEvent) => void>();
const elToFocusListeners = new WeakMap<Element, (e: MouseEvent) => void>();
const dzToHandles = new Map<HTMLElement, { update(newOptions: Options): void; destroy(): void }>();
const dzToConfig = new Map<HTMLElement, Config>();
const typeToDropZones = new Map<string, Set<HTMLElement>>();
// Each document with zones gets its own aria elements, because a zone can live in another window than the one that loaded
// this module. That document and the same-origin documents around it, up to the loading document, get keydown, click and
// pagehide handlers, so that Escape and a click outside end a drag from any of them. A zone is released from the documents
// it registered with, even if it has moved to another document since.
const dzToDocuments = new Map<HTMLElement, Document[]>();
const documentToRegistration = new Map<Document, Registration>();

/* TODO (potentially)
 * what's the deal with the black border of voice-reader not following focus?
 * maybe keep focus on the last dragged item upon drop?
 */

let INSTRUCTION_IDs: ReturnType<typeof initAria> | undefined;

/* drop-zones registration management */
function getDocumentsAround(doc: Document): Document[] {
    const docs = [doc];
    for (
        let frame = doc.defaultView?.frameElement;
        // eslint-disable-next-line no-restricted-globals -- the documents above the loading one belong to whatever hosts the app
        frame && docs[docs.length - 1] !== document;
        frame = getWindowOf(frame).frameElement
    ) {
        docs.push(frame.ownerDocument);
    }
    return docs;
}
function retainDocuments(dropZoneEl: HTMLElement): void {
    const docs = getDocumentsAround(dropZoneEl.ownerDocument);
    docs.forEach((doc, idx) => {
        let registration = documentToRegistration.get(doc);
        if (!registration) {
            printDebug(() => "adding global keydown and click handlers");
            // Handlers of its own, so that removing them through a window that has since navigated to another document
            // leaves the handlers of that document alone
            // (each handler is added for its own event type, so it gets the event it expects)
            const handlers = {
                keydown: globalKeyDownHandler,
                click: globalClickHandler,
                pagehide: handleWindowHidden,
            } as unknown as Record<string, EventListener>;
            registration = { win: doc.defaultView, zoneCount: 0, documentCount: 0, handlers: {} };
            Object.entries(handlers).forEach(([type, handler]) => {
                // registration is assigned just above, before this callback runs
                registration!.handlers[type] = (e) => handler(e);
                registration!.win?.addEventListener(type, registration!.handlers[type]);
            });
            documentToRegistration.set(doc, registration);
        }
        registration.documentCount++;
        if (idx === 0 && registration.zoneCount++ === 0) {
            INSTRUCTION_IDs = initAria(doc);
        }
    });
    dzToDocuments.set(dropZoneEl, docs);
}
function releaseDocuments(dropZoneEl: HTMLElement): void {
    const docs = dzToDocuments.get(dropZoneEl);
    if (!docs) return;
    dzToDocuments.delete(dropZoneEl);
    docs.forEach((doc, idx) => {
        // retainDocuments registered each of the zone's documents, and a registration is only deleted once no zone retains it
        const registration = documentToRegistration.get(doc)!;
        if (idx === 0 && --registration.zoneCount === 0) {
            destroyAria(doc);
        }
        if (--registration.documentCount > 0) return;
        printDebug(() => "removing global keydown and click handlers");
        documentToRegistration.delete(doc);
        Object.entries(registration.handlers).forEach(([type, handler]) =>
            registration.win?.removeEventListener(type, handler),
        );
    });
}
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
    // a zone that moved to another document since it registered takes its registration along
    if (dzToDocuments.get(dropZoneEl)?.[0] !== dropZoneEl.ownerDocument) {
        releaseDocuments(dropZoneEl);
        retainDocuments(dropZoneEl);
    }
}
function unregisterDropZone(dropZoneEl: HTMLElement, type: string): void {
    printDebug(() => "unregistering drop-zone");
    if (isDragging && focusedDz === dropZoneEl) {
        handleDrop();
    }
    const dropZones = typeToDropZones.get(type);
    if (!dropZones || !dropZones.delete(dropZoneEl)) return;
    decrementActiveDropZoneCount();
    if (dropZones.size === 0) {
        typeToDropZones.delete(type);
    }
    releaseDocuments(dropZoneEl);
}

function globalKeyDownHandler(e: KeyboardEvent): void {
    if (!isDragging) return;
    switch (e.key) {
        case "Escape": {
            handleDrop();
            break;
        }
    }
}

function globalClickHandler(e: MouseEvent): void {
    if (!isDragging) return;
    // the listener is on a window, and a null activeElement is not a drag target, which has() reports
    if (!allDragTargets.has((e.currentTarget as Window).document.activeElement as Element)) {
        printDebug(() => "clicked outside of any draggable");
        handleDrop();
    }
}

// The focused zone's window is going away: it was closed or navigated, or its iframe was removed. End the drag so the
// zones in the other windows become tab stops again.
function handleWindowHidden(e: PageTransitionEvent): void {
    if (isDragging && focusedDz && getWindowOf(focusedDz) === e.currentTarget) {
        printDebug(() => "the focused zone's window is going away");
        handleDrop();
    }
}

// Tab can cross iframe boundaries, but a destination must still belong to the drag's own document.
function isInDragDocument(dropZoneEl: HTMLElement, doc: Document | undefined = dragDocument): boolean {
    return dropZoneEl.ownerDocument === doc;
}

function isAboveOrLeftOf(el: Element, otherEl: Element): boolean {
    const position = el.getBoundingClientRect();
    const otherPosition = otherEl.getBoundingClientRect();
    return position.top < otherPosition.top || position.left < otherPosition.left;
}

// Tab order, focus-driven transfers, styling and announcements must agree about which zones can receive the item.
// tabindex=-1 alone is not a restriction: a click or consumer code can still focus a zone.
function isKeyboardDropTarget(dropZoneEl: HTMLElement): boolean {
    // callers pass registered zones, which have a config, and only call it during a drag, while focusedItem is set
    const config = dzToConfig.get(dropZoneEl)!;
    return (
        config.type === draggedItemType &&
        !config.dropFromOthersDisabled &&
        !focusedItem!.contains(dropZoneEl) &&
        isInDragDocument(dropZoneEl)
    );
}

function getActiveDragTabIndex(dropZoneEl: HTMLElement): number {
    return dropZoneEl !== focusedDz && isKeyboardDropTarget(dropZoneEl) ? 0 : -1;
}

function refreshActiveDragTabIndices(): void {
    dzToConfig.forEach((_, dropZoneEl) => {
        dropZoneEl.tabIndex = getActiveDragTabIndex(dropZoneEl);
    });
}

function grabIsAlive(): boolean {
    // only called during a drag, and focusedDz is set in handleDragStart for the whole drag
    const focusedConfig = dzToConfig.get(focusedDz!);
    if (focusedConfig?.items.some((item) => item[ITEM_ID_KEY] === focusedItemId)) return true;
    printDebug(() => "dragged item is gone, dropping");
    handleDrop();
    return false;
}

function handleZoneFocus(e: FocusEvent): void {
    printDebug(() => "zone focus");
    if (!isDragging) return;
    // the focus listener is on a zone
    const newlyFocusedDz = e.currentTarget as HTMLElement;
    if (newlyFocusedDz === focusedDz || !isKeyboardDropTarget(newlyFocusedDz)) return;

    if (!grabIsAlive()) return;

    // The drag is in progress, so focusedDz and focusedItemId are set. grabIsAlive found the config of focusedDz and the
    // item in its items, and isKeyboardDropTarget read the config of newlyFocusedDz.
    const dzFrom = focusedDz!;
    const movedItemId = focusedItemId!;
    focusedDzLabel = newlyFocusedDz.getAttribute("aria-label") || "";
    const { items: originItems } = dzToConfig.get(focusedDz!)!;
    const originItem = originItems.find((item) => item[ITEM_ID_KEY] === focusedItemId)!;
    const originIdx = originItems.indexOf(originItem);
    const itemToMove = originItems.splice(originIdx, 1)[0];
    const { items: targetItems, autoAriaDisabled } = dzToConfig.get(newlyFocusedDz)!;
    if (isAboveOrLeftOf(newlyFocusedDz, focusedDz!)) {
        targetItems.push(itemToMove);
        if (!autoAriaDisabled) {
            announceToScreenReader(
                "movedToZoneEnd",
                {
                    itemLabel: focusedItemLabel,
                    zoneLabel: focusedDzLabel,
                    position: targetItems.length,
                    count: targetItems.length,
                },
                newlyFocusedDz.ownerDocument,
            );
        }
    } else {
        targetItems.unshift(itemToMove);
        if (!autoAriaDisabled) {
            announceToScreenReader(
                "movedToZoneStart",
                {
                    itemLabel: focusedItemLabel,
                    zoneLabel: focusedDzLabel,
                    position: 1,
                    count: targetItems.length,
                },
                newlyFocusedDz.ownerDocument,
            );
        }
    }
    // An announcement formatter can end the drag, for example by removing its window. The item still moves.
    if (isDragging) focusedDz = newlyFocusedDz;
    dispatchFinalizeEvent(dzFrom, originItems, {
        trigger: TRIGGERS.DROPPED_INTO_ANOTHER,
        id: movedItemId,
        source: SOURCES.KEYBOARD,
    });
    if (dzToConfig.has(newlyFocusedDz)) {
        dispatchFinalizeEvent(newlyFocusedDz, targetItems, {
            trigger: TRIGGERS.DROPPED_INTO_ZONE,
            id: movedItemId,
            source: SOURCES.KEYBOARD,
        });
    }
}

function triggerAllDzsUpdate(): void {
    // every zone with handles has a config: configure sets it before the handles are stored, and destroy deletes both
    dzToHandles.forEach(({ update }, dz) => update(dzToConfig.get(dz)!));
}

function handleDrop(dispatchConsider = true): void {
    if (!isDragging || !focusedDz) return;
    printDebug(() => "drop");
    const droppedDz = focusedDz;
    const droppedConfig = dzToConfig.get(droppedDz);
    // the drag is in progress, and handleDragStart set its item id and type for the whole drag
    const droppedItemId = focusedItemId!;
    const droppedItemType = draggedItemType!;
    // Not reached during a drag: destroying the focused zone drops first (unregisterDropZone), before its config is deleted.
    if (!droppedConfig) return;
    const droppedItemLabel = focusedItemLabel;
    const droppedDzLabel = focusedDzLabel;
    const droppedDocument = dragDocument;
    // Clear global drag state before running any consumer code: an announcement formatter, a blur handler or a consider
    // handler. A synchronous handler may destroy the focused zone or remove its window, and neither must recursively
    // enter handleDrop.
    focusedItem = null;
    focusedItemId = null;
    focusedItemLabel = "";
    draggedItemType = null;
    focusedDz = null;
    focusedDzLabel = "";
    dragDocument = undefined;
    isDragging = false;

    if (!droppedConfig.autoAriaDisabled) {
        // Include the destination and final position so localized messages can describe the completed drop.
        const droppedItems = droppedConfig.items;
        const droppedIdx = droppedItems.findIndex((item) => item[ITEM_ID_KEY] === droppedItemId);
        announceToScreenReader(
            "dropped",
            {
                itemLabel: droppedItemLabel,
                zoneLabel: droppedDzLabel,
                position: (droppedIdx < 0 ? 0 : droppedIdx) + 1,
                count: droppedItems.length,
            },
            droppedDz.ownerDocument,
        );
    }
    const { activeElement } = droppedDz.ownerDocument;
    // A null activeElement is not a drag target, which has() reports.
    // The drag targets are the zones' children, the rendered items, HTML elements.
    if (allDragTargets.has(activeElement as Element)) {
        (activeElement as HTMLElement).blur();
    }
    if (dispatchConsider) {
        dispatchConsiderEvent(droppedDz, droppedConfig.items, {
            trigger: TRIGGERS.DRAG_STOPPED,
            id: droppedItemId,
            source: SOURCES.KEYBOARD,
        });
    }
    const dropZones = typeToDropZones.get(droppedItemType);
    if (dropZones) {
        // the registered zones have a config: destroy unregisters a zone before it deletes its config
        styleInactiveDropZones(
            Array.from(dropZones).filter((dz) => isInDragDocument(dz, droppedDocument)),
            (dz) => dzToConfig.get(dz)!.dropTargetStyle,
            (dz) => dzToConfig.get(dz)!.dropTargetClasses,
        );
    }
    triggerAllDzsUpdate();
}
//////
export function dndzone(node: HTMLElement, options: Options): { update(newOptions: Options): void; destroy(): void } {
    let destroyed = false;
    // configure(options) below sets items and type. Before that only the first configure call reads them, and it checks
    // config.type before setting it.
    const config = {
        items: undefined,
        type: undefined,
        dragDisabled: false,
        zoneTabIndex: 0,
        zoneItemTabIndex: 0,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses: [],
        autoAriaDisabled: false,
    } as unknown as Config;

    function swap(arr: Item[], i: number, j: number): void {
        if (arr.length <= 1) return;
        arr.splice(j, 1, arr.splice(i, 1, arr[j])[0]);
    }

    function ownsArrowKey(e: KeyboardEvent): boolean {
        // Only the grabbed item owns reorder keys. Nested controls and other items keep their own key behaviour.
        return (
            isDragging &&
            node === focusedDz &&
            isInDragDocument(node) &&
            e.currentTarget === focusedItem &&
            e.target === focusedItem
        );
    }

    function handleKeyDown(e: KeyboardEvent): void {
        printDebug(() => ["handling key down", e.key]);
        switch (e.key) {
            case "Enter":
            case " ": {
                // keys outside the configured trigger belong to the consumer - don't claim them in any way
                if (!isKeyboardDragTriggerKey(e.key)) {
                    return;
                }
                // we don't want to affect nested input elements or clickable elements
                // the target is the draggable or an element inside it, disabled is only set on form controls and href on links
                if (
                    ((e.target as HTMLElement & { disabled?: boolean }).disabled !== undefined ||
                        (e.target as HTMLElement & { href?: string }).href ||
                        (e.target as HTMLElement).isContentEditable) &&
                    !allDragTargets.has(e.target as HTMLElement)
                ) {
                    return;
                }
                e.preventDefault(); // preventing scrolling on spacebar
                e.stopPropagation();
                if (isDragging) {
                    // TODO - should this trigger a drop? only here or in general (as in when hitting space or enter outside of any zone)?
                    handleDrop();
                } else {
                    // drag start
                    handleDragStart(e);
                }
                break;
            }
            case "ArrowDown":
            case "ArrowRight": {
                if (!ownsArrowKey(e)) return;
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                // This zone is configured, because destroy removes its listeners before it deletes its config.
                // The listener is on one of its children. ownsArrowKey says the drag is in progress, so focusedItemId is set.
                const { items } = dzToConfig.get(node)!;
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget as Element);
                printDebug(() => ["arrow down", idx]);
                if (idx < children.length - 1) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader(
                            "movedToPosition",
                            {
                                itemLabel: focusedItemLabel,
                                zoneLabel: focusedDzLabel,
                                position: idx + 2,
                                count: items.length,
                            },
                            node.ownerDocument,
                        );
                    }
                    // An announcement formatter can end or move the drag, for example by removing its window.
                    if (!ownsArrowKey(e)) break;
                    swap(items, idx, idx + 1);
                    dispatchFinalizeEvent(node, items, {
                        trigger: TRIGGERS.DROPPED_INTO_ZONE,
                        id: focusedItemId!,
                        source: SOURCES.KEYBOARD,
                    });
                }
                break;
            }
            case "ArrowUp":
            case "ArrowLeft": {
                if (!ownsArrowKey(e)) return;
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                // This zone is configured, because destroy removes its listeners before it deletes its config.
                // The listener is on one of its children. ownsArrowKey says the drag is in progress, so focusedItemId is set.
                const { items } = dzToConfig.get(node)!;
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget as Element);
                printDebug(() => ["arrow up", idx]);
                if (idx > 0) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader(
                            "movedToPosition",
                            {
                                itemLabel: focusedItemLabel,
                                zoneLabel: focusedDzLabel,
                                position: idx,
                                count: items.length,
                            },
                            node.ownerDocument,
                        );
                    }
                    // An announcement formatter can end or move the drag, for example by removing its window.
                    if (!ownsArrowKey(e)) break;
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {
                        trigger: TRIGGERS.DROPPED_INTO_ZONE,
                        id: focusedItemId!,
                        source: SOURCES.KEYBOARD,
                    });
                }
                break;
            }
        }
    }
    function handleDragStart(e: Event): void {
        printDebug(() => "drag start");
        // the keydown and click listeners are on the zone's children, the rendered items, HTML elements
        setCurrentFocusedItem(e.currentTarget as HTMLElement);
        focusedDz = node;
        focusedDzLabel = node.getAttribute("aria-label") || "";
        draggedItemType = config.type;
        isDragging = true;
        dragDocument = node.ownerDocument;
        // configure registered this zone under config.type, and the registered zones have a config
        const dropTargets = Array.from(typeToDropZones.get(config.type)!).filter(
            (dz) => dz === focusedDz || isKeyboardDropTarget(dz),
        );
        styleActiveDropZones(
            dropTargets,
            (dz) => dzToConfig.get(dz)!.dropTargetStyle,
            (dz) => dzToConfig.get(dz)!.dropTargetClasses,
        );
        if (!config.autoAriaDisabled) {
            // Include the starting position so localized messages can describe where the item was picked up.
            const startItems = dzToConfig.get(node)!.items;
            const startIdx = startItems.findIndex((item) => item[ITEM_ID_KEY] === focusedItemId);
            announceToScreenReader(
                "dragStarted",
                {
                    itemLabel: focusedItemLabel,
                    zoneLabel: focusedDzLabel,
                    position: (startIdx < 0 ? 0 : startIdx) + 1,
                    count: startItems.length,
                    canMoveBetweenZones: dropTargets.length > 1,
                },
                node.ownerDocument,
            );
        }
        // an announcement formatter can end the drag, for example by removing its window
        if (!isDragging) return;
        // the drag is still in progress, so setCurrentFocusedItem's focusedItemId is still set
        dispatchConsiderEvent(node, dzToConfig.get(node)!.items, {
            trigger: TRIGGERS.DRAG_STARTED,
            id: focusedItemId!,
            source: SOURCES.KEYBOARD,
        });
        triggerAllDzsUpdate();
    }

    function handleClick(e: MouseEvent): void {
        if (!isDragging) return;
        if (e.currentTarget === focusedItem) return;
        e.stopPropagation();
        handleDrop();
        // The drag-stopped handler can tear this zone down, disable dragging in it or remove the clicked item
        const clickedEl = e.currentTarget as HTMLElement;
        if (destroyed || config.dragDisabled || clickedEl.parentElement !== node) return;
        handleDragStart(e);
    }
    function setCurrentFocusedItem(draggableEl: HTMLElement): void {
        // this zone is configured, because destroy removes its listeners before it deletes its config
        const { items } = dzToConfig.get(node)!;
        const children = Array.from(node.children);
        const focusedItemIdx = children.indexOf(draggableEl);
        focusedItem = draggableEl;
        focusedItem.tabIndex = config.zoneItemTabIndex;
        focusedItemId = items[focusedItemIdx][ITEM_ID_KEY];
        focusedItemLabel = children[focusedItemIdx].getAttribute("aria-label") || "";
    }

    function configure({
        items = [],
        type: newType = DEFAULT_DROP_ZONE_TYPE,
        dragDisabled = false,
        zoneTabIndex = 0,
        zoneItemTabIndex = 0,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses = [],
        autoAriaDisabled = false,
        onconsider,
        onfinalize,
    }: Options): void {
        config.onconsider = onconsider;
        config.onfinalize = onfinalize;
        // a torn-down zone gets no callbacks, even when the drop that its teardown causes configures it once more
        if (!destroyed) registerZoneCallbacks(node, { onconsider, onfinalize });
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.dropFromOthersDisabled = dropFromOthersDisabled;
        config.zoneTabIndex = zoneTabIndex;
        config.zoneItemTabIndex = zoneItemTabIndex;
        config.dropTargetStyle = dropTargetStyle;
        config.dropTargetClasses = dropTargetClasses;
        config.autoAriaDisabled = autoAriaDisabled;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);
        if (!autoAriaDisabled) {
            node.setAttribute("role", "list");
            // registerDropZone above set it through retainDocuments. initAria returns null only on the server, where
            // actions do not run.
            node.setAttribute(
                "aria-describedby",
                dragDisabled ? INSTRUCTION_IDs!.DND_ZONE_DRAG_DISABLED : INSTRUCTION_IDs!.DND_ZONE_ACTIVE,
            );
        }
        dzToConfig.set(node, config);

        let itemMovedToThisZone = false;
        if (isDragging) {
            itemMovedToThisZone =
                isInDragDocument(node) &&
                config.type === draggedItemType &&
                config.items.some((item) => item[ITEM_ID_KEY] === focusedItemId) &&
                node !== focusedDz;
            if (itemMovedToThisZone) {
                focusedDz = node;
                focusedDzLabel = node.getAttribute("aria-label") || "";
            }
            node.tabIndex = getActiveDragTabIndex(node);
        } else {
            node.tabIndex = config.zoneTabIndex;
        }

        node.addEventListener("focus", handleZoneFocus);

        for (let i = 0; i < node.children.length; i++) {
            // the zone's children are the rendered items, HTML elements
            const draggableEl = node.children[i] as HTMLElement;
            allDragTargets.add(draggableEl);
            draggableEl.tabIndex = isDragging ? -1 : config.zoneItemTabIndex;
            if (!autoAriaDisabled) {
                draggableEl.setAttribute("role", "listitem");
            }
            // removeEventListener ignores undefined, which it gets for a child without a listener yet
            draggableEl.removeEventListener("keydown", elToKeyDownListeners.get(draggableEl) as EventListener);
            draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl) as EventListener);
            if (!dragDisabled) {
                draggableEl.addEventListener("keydown", handleKeyDown);
                elToKeyDownListeners.set(draggableEl, handleKeyDown);
                draggableEl.addEventListener("click", handleClick);
                elToFocusListeners.set(draggableEl, handleClick);
            }
            if (
                isDragging &&
                isInDragDocument(node) &&
                config.type === draggedItemType &&
                config.items[i]?.[ITEM_ID_KEY] === focusedItemId
            ) {
                printDebug(() => ["focusing on", { i, focusedItemId }]);
                // if it is a nested dropzone, it was re-rendered and we need to refresh our pointer
                focusedItem = draggableEl;
                focusedItem.tabIndex = config.zoneItemTabIndex;
                // without this the element loses focus if it moves backwards in the list
                draggableEl.focus();
            }
        }
        // Focusing the replacement item runs its focus handler, which can end the drag, for example by removing its window
        if (itemMovedToThisZone && isDragging) {
            // Nested actions are configured before their parent action. Refresh only
            // after focusedItem points at the replacement so nested zones stay untabbable.
            refreshActiveDragTabIndices();
        }
    }
    configure(options);

    const handles: { update(newOptions: Options): void; destroy(): void } = {
        update: (newOptions: Options) => {
            printDebug(() => `keyboard dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            // destroying the focused zone drops into it below, and a torn-down zone gets no callbacks
            unregisterZoneCallbacks(node);
            printDebug(() => "keyboard dndzone will destroy");
            node.removeEventListener("focus", handleZoneFocus);
            // removeEventListener ignores undefined, which it gets for a child without a listener
            for (const draggableEl of node.children) {
                draggableEl.removeEventListener("keydown", elToKeyDownListeners.get(draggableEl) as EventListener);
                draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl) as EventListener);
            }
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
            dzToHandles.delete(node);
        },
    };
    dzToHandles.set(node, handles);
    return handles;
}
