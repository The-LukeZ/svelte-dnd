import { SOURCES, TRIGGERS } from "../constants";
import { isKeyboardDragTriggerKey } from "../keyboardDragTrigger";
import { dndzone } from "../action";
import { createStore } from "./simpleStore";
import { getWindowOf } from "../helpers/util";
import { registerZoneInternalHooks } from "../helpers/dispatcher";
import type { ActionReturn } from "svelte/action";
import type { DndZoneAttributes, Item, Options } from "../types";

const isItemsDragDisabled = createStore(true);
const userDragDisabled = createStore(false);

function getAddedOptions(): { dragDisabled: boolean; zoneItemTabIndex: number } {
    return {
        dragDisabled: userDragDisabled.get() || isItemsDragDisabled.get(),
        zoneItemTabIndex: -1,
    };
}

/**
 * A wrapper action that wraps around the dndzone action to make it easy to work with drag handles.
 * When using this you must also use the 'dragHandle' action (see below) on an element inside each item within the zone.
 * Credit for the idea and initial implementation goes to @gleuch (Greg Leuch) and @geovie (Georg Vienna)
 *
 * @param options - will be passed down to the dndzone
 */
export function dragHandleZone<T extends Item>(
    node: HTMLElement,
    options: Options<T>,
): ActionReturn<Options<T>, DndZoneAttributes<T>> {
    // Initialise stores from initial options
    userDragDisabled.set(options?.dragDisabled ?? false);

    let currentOptions = options;

    const zone = dndzone(node, {
        ...currentOptions,
        ...getAddedOptions(),
    });

    // dndzone always returns both update and destroy
    function updateZone(): void {
        zone.update!({
            ...currentOptions,
            ...getAddedOptions(),
        });
    }

    // Subscribe to internal store so finishing a drag updates the zone
    isItemsDragDisabled.subscribe(updateZone);

    // We don't need to subscribe to userDragDisabled here because updates to
    // it always come through the `update` lifecycle and will call `updateZone`
    // anyway.

    // The handle bookkeeping runs as the zone's internal hooks, before the user's onconsider/onfinalize. Unlike the user's
    // callbacks they stay after this zone is torn down, so isItemsDragDisabled resets even when the drag ends on events
    // the engine sends to this zone after its teardown: the keyboard drop that destroying the focused zone causes, or
    // a pointer finalize to a destroyed origin or a zone scheduled for removal. They are never removed: a later zone on
    // the same element replaces them, and a stray reset at the end of a drag sets a store that is already true.
    registerZoneInternalHooks(node, {
        onconsider: ({ info: { source, trigger } }) => {
            // Ensure dragging is stopped on drag finish via keyboard
            if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
                isItemsDragDisabled.set(true);
            }
        },
        onfinalize: ({ info: { source } }) => {
            // Ensure dragging is stopped on drag finish via pointer (mouse, touch)
            if (source === SOURCES.POINTER) {
                isItemsDragDisabled.set(true);
            }
        },
    });

    return {
        update: (newOptions: Options<T>) => {
            currentOptions = newOptions;
            // keep store in sync with external prop
            userDragDisabled.set(currentOptions?.dragDisabled ?? false);
            updateZone();
        },
        destroy: () => {
            // dndzone always returns both update and destroy
            zone.destroy!();
            isItemsDragDisabled.unsubscribe(updateZone);
        },
    };
}

/**
 * This should be used to mark drag handles inside items that belong to a 'dragHandleZone' (see above)
 */
export function dragHandle(handle: HTMLElement): { update: () => void; destroy: () => void } {
    handle.setAttribute("role", "button");
    // assigned in startDrag before resetStartDrag is registered, so every read follows an assignment
    let releaseWindow: Window;

    function startDrag(e: MouseEvent | TouchEvent): void {
        // preventing default to prevent lag on touch devices (because of the browser checking for screen scrolling)
        e.preventDefault();
        isItemsDragDisabled.set(false);

        // Reset the startDrag/isItemsDragDisabled if the user releases the mouse/touch without initiating a drag, or if the
        // handle's window goes away first
        releaseWindow = getWindowOf(handle);
        releaseWindow.addEventListener("mouseup", resetStartDrag);
        releaseWindow.addEventListener("touchend", resetStartDrag);
        releaseWindow.addEventListener("pagehide", resetStartDrag);
    }

    function handleKeyDown(e: KeyboardEvent): void {
        if (isKeyboardDragTriggerKey(e.key)) isItemsDragDisabled.set(false);
    }

    function resetStartDrag(): void {
        isItemsDragDisabled.set(true);
        releaseWindow.removeEventListener("mouseup", resetStartDrag);
        releaseWindow.removeEventListener("touchend", resetStartDrag);
        releaseWindow.removeEventListener("pagehide", resetStartDrag);
    }

    const recomputeHandleState = (): void => {
        const userDisabled = userDragDisabled.get();
        const internalDisabled = isItemsDragDisabled.get();

        if (userDisabled) {
            handle.tabIndex = -1;
            handle.style.cursor = ""; // default cursor
        } else {
            handle.tabIndex = internalDisabled ? 0 : -1;
            handle.style.cursor = internalDisabled ? "grab" : "grabbing";
        }
    };

    // Subscribe to both stores
    userDragDisabled.subscribe(recomputeHandleState);
    isItemsDragDisabled.subscribe(recomputeHandleState);

    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag);
    handle.addEventListener("keydown", handleKeyDown);
    return {
        update: () => {},
        destroy: () => {
            handle.removeEventListener("mousedown", startDrag);
            handle.removeEventListener("touchstart", startDrag);
            handle.removeEventListener("keydown", handleKeyDown);
            userDragDisabled.unsubscribe(recomputeHandleState);
            isItemsDragDisabled.unsubscribe(recomputeHandleState);
        },
    };
}
