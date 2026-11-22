import {
    DRAGGED_ENTERED_EVENT_NAME,
    DRAGGED_LEFT_EVENT_NAME,
    DRAGGED_OVER_INDEX_EVENT_NAME,
} from "./helpers/dispatcher";

/**
 * The values of `info.trigger` in a drag event: what made the zone receive it. The type of the same name is the union
 * of these values.
 */
// oxlint-disable-next-line no-redeclare -- the value and its union type share a name, as the old enum did
export const TRIGGERS: {
    /** A drag started from this zone. */
    readonly DRAG_STARTED: "dragStarted";
    /** The dragged item entered this zone. Only for pointer drags. */
    readonly DRAGGED_ENTERED: "draggedEntered";
    /** Sent to the zone the drag started from when the item enters another zone. Only for pointer drags. */
    readonly DRAGGED_ENTERED_ANOTHER: "dragEnteredAnother";
    /** The dragged item moved over another index of this zone. Only for pointer drags. */
    readonly DRAGGED_OVER_INDEX: "draggedOverIndex";
    /** The dragged item left this zone. Only for pointer drags. */
    readonly DRAGGED_LEFT: "draggedLeft";
    /**
     * Sent to the zone the drag started from when the item is outside of every zone, with the item back at its
     * original index. Only for pointer drags.
     */
    readonly DRAGGED_LEFT_ALL: "draggedLeftAll";
    /** The item was dropped into this zone. A keyboard drag sends it each time an arrow key moves the item. */
    readonly DROPPED_INTO_ZONE: "droppedIntoZone";
    /** Sent to the zone the item came from when it is dropped into another zone. */
    readonly DROPPED_INTO_ANOTHER: "droppedIntoAnother";
    /** The item was dropped outside of every zone, and goes back to the zone it came from. Only for pointer drags. */
    readonly DROPPED_OUTSIDE_OF_ANY: "droppedOutsideOfAny";
    /** The user ended a keyboard drag. Only for keyboard drags. */
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

/**
 * The values of `info.source` in a drag event: the kind of input that performed the drag. The type of the same name is
 * the union of these values.
 */
// oxlint-disable-next-line no-redeclare -- the value and its union type share a name, as the old enum did
export const SOURCES = {
    /** A mouse or a touch. */
    POINTER: "pointer",
    /** The keyboard. */
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

/**
 * The property set to `true` on the shadow item: the placeholder that stands in the items for the dragged item during a
 * pointer drag. Check it in the `#each` block to style the placeholder.
 */
export const SHADOW_ITEM_MARKER_PROPERTY_NAME = "isDndShadowItem";
export const SHADOW_ELEMENT_ATTRIBUTE_NAME = "data-is-dnd-shadow-item-internal";
export const SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME = "data-is-dnd-shadow-item-hint";
/**
 * The id of the shadow item when a pointer drag starts. Once the zone no longer renders the original item, usually a
 * frame later, the shadow item takes the dragged item's id for the rest of the drag. To find the shadow item, check
 * `SHADOW_ITEM_MARKER_PROPERTY_NAME` instead of this id.
 */
export const SHADOW_PLACEHOLDER_ITEM_ID = "id:dnd-shadow-placeholder-0000";
/** The id of the element that follows the pointer during a pointer drag, for styling it or finding it in tests. */
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
 * Checks that the item id key can be overridden now, without changing it. Internal - the setter and configure share it.
 * @throws {Error} if there are rendered dndzones or if the key is not a string
 */
export function assertValidIdKey(key: unknown): void {
    if (activeDndZoneCount > 0) {
        throw new Error("can only override the id key before initialising any dndzone");
    }
    if (typeof key !== "string") {
        throw new Error("item id key has to be a string");
    }
}

/**
 * Allows using another key instead of "id" in the items data. This is global and applies to all dndzones.
 * Has to be called when there are no rendered dndzones whatsoever.
 * @throws {Error} if it was called when there are rendered dndzones or if it is given the wrong type (not a string)
 */
export function overrideItemIdKeyNameBeforeInitialisingDndZones(newKeyName: string): void {
    assertValidIdKey(newKeyName);
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
