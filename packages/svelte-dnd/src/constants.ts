import {
    DRAGGED_ENTERED_EVENT_NAME,
    DRAGGED_LEFT_EVENT_NAME,
    DRAGGED_OVER_INDEX_EVENT_NAME,
} from "./helpers/dispatcher";

// oxlint-disable-next-line no-redeclare -- the value and its union type share a name, as the old enum did
export const TRIGGERS: {
    readonly DRAG_STARTED: "dragStarted";
    /** only relevant for pointer interactions */
    readonly DRAGGED_ENTERED: "draggedEntered";
    /** only relevant for pointer interactions */
    readonly DRAGGED_ENTERED_ANOTHER: "dragEnteredAnother";
    /** only relevant for pointer interactions */
    readonly DRAGGED_OVER_INDEX: "draggedOverIndex";
    /** only relevant for pointer interactions */
    readonly DRAGGED_LEFT: "draggedLeft";
    /** only relevant for pointer interactions */
    readonly DRAGGED_LEFT_ALL: "draggedLeftAll";
    readonly DROPPED_INTO_ZONE: "droppedIntoZone";
    readonly DROPPED_INTO_ANOTHER: "droppedIntoAnother";
    readonly DROPPED_OUTSIDE_OF_ANY: "droppedOutsideOfAny";
    /** only relevant for keyboard interactions - when the use exists dragging mode */
    readonly DRAG_STOPPED: "dragStopped";
} = {
    DRAG_STARTED: "dragStarted",
    DRAGGED_ENTERED: DRAGGED_ENTERED_EVENT_NAME,
    DRAGGED_ENTERED_ANOTHER: "dragEnteredAnother",
    DRAGGED_OVER_INDEX: DRAGGED_OVER_INDEX_EVENT_NAME,
    DRAGGED_LEFT: DRAGGED_LEFT_EVENT_NAME,
    DRAGGED_LEFT_ALL: "draggedLeftAll",
    DROPPED_INTO_ZONE: "droppedIntoZone",
    DROPPED_INTO_ANOTHER: "droppedIntoAnother",
    DROPPED_OUTSIDE_OF_ANY: "droppedOutsideOfAny",
    DRAG_STOPPED: "dragStopped",
};
export type TRIGGERS = (typeof TRIGGERS)[keyof typeof TRIGGERS];

// oxlint-disable-next-line no-redeclare -- the value and its union type share a name, as the old enum did
export const SOURCES = {
    /** mouse or touch */
    POINTER: "pointer",
    KEYBOARD: "keyboard",
} as const;
export type SOURCES = (typeof SOURCES)[keyof typeof SOURCES];

// Maps each valid global keyboardDragTrigger value (see setKeyboardDragTrigger) to the
// KeyboardEvent.key values it covers. Keys that are not part of the active trigger are left
// completely untouched by the library.
export const KEYBOARD_DRAG_TRIGGER_KEYS: { space: string[]; enter: string[]; space_or_enter: string[] } = {
    space: [" "],
    enter: ["Enter"],
    space_or_enter: [" ", "Enter"],
};
export const DEFAULT_KEYBOARD_DRAG_TRIGGER = "space_or_enter";

// Human-readable phrase for each trigger, used by the default screen-reader instruction (see
// src/helpers/aria.ts). Must have exactly the same keys as KEYBOARD_DRAG_TRIGGER_KEYS above.
export const KEYBOARD_DRAG_TRIGGER_PHRASES = {
    space: "space-bar",
    enter: "enter",
    space_or_enter: "space-bar or enter",
};

export const SHADOW_ITEM_MARKER_PROPERTY_NAME = "isDndShadowItem";
export const SHADOW_ELEMENT_ATTRIBUTE_NAME = "data-is-dnd-shadow-item-internal";
export const SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME = "data-is-dnd-shadow-item-hint";
export const SHADOW_PLACEHOLDER_ITEM_ID = "id:dnd-shadow-placeholder-0000";
export const DRAGGED_ELEMENT_ID = "dnd-action-dragged-el";

export let ITEM_ID_KEY: string = "id";
let activeDndZoneCount = 0;
export function incrementActiveDropZoneCount(): void {
    activeDndZoneCount++;
}
export function decrementActiveDropZoneCount(): void {
    if (activeDndZoneCount === 0) {
        throw new Error("Bug! trying to decrement when there are no dropzones");
    }
    activeDndZoneCount--;
}

/**
 * Allows using another key instead of "id" in the items data. This is global and applies to all dndzones.
 * Has to be called when there are no rendered dndzones whatsoever.
 * @throws {Error} if it was called when there are rendered dndzones or if it is given the wrong type (not a string)
 */
export function overrideItemIdKeyNameBeforeInitialisingDndZones(newKeyName: string): void {
    if (activeDndZoneCount > 0) {
        throw new Error("can only override the id key before initialising any dndzone");
    }
    if (typeof newKeyName !== "string") {
        throw new Error("item id key has to be a string");
    }
    printDebug(() => ["overriding item id key name", newKeyName]);
    ITEM_ID_KEY = newKeyName;
}

// eslint-disable-next-line no-restricted-globals -- detects server-side rendering
export const isOnServer: boolean = typeof window === "undefined";

export let printDebug: (generateMessage: () => unknown, logFunction?: (...args: unknown[]) => void) => void = () => {};

/**
 * Allows the user to show/hide console debug output
 */
export function setDebugMode(isDebug: boolean): void {
    if (isDebug) {
        printDebug = (generateMessage, logFunction = console.debug) => {
            const message = generateMessage();
            if (Array.isArray(message)) {
                logFunction(...message);
            } else {
                logFunction(message);
            }
        };
    } else {
        printDebug = () => {};
    }
}
