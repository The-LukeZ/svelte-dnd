import { SOURCES, TRIGGERS, printDebug } from "../constants";
import { isKeyboardDragTriggerKey } from "../keyboardDragTrigger";
import { createZone, readOptions } from "../action";
import { createStore } from "./simpleStore";
import { getWindowOf } from "../helpers/util";
import { registerZoneInternalHooks } from "../helpers/dispatcher";
import { fromAction } from "svelte/attachments";
import type { Attachment } from "svelte/attachments";
import type { Options } from "../types";

type Store<T> = ReturnType<typeof createStore<T>>;

/** Set on every handle zone element, so a handle finds its zone with closest() */
const HANDLE_ZONE_ATTRIBUTE = "data-dnd-handle-zone";

interface HandleZoneState {
    /** the zone's dragDisabled option */
    userDragDisabled: Store<boolean>;
    /** the handles bound to this zone, so a nested zone created later can take over its own */
    handles: Set<HandleBinding>;
}

interface HandleBinding {
    handle: HTMLElement;
    /** binds the handle to a zone, replacing the zone it was bound to */
    bind(state: HandleZoneState): void;
    /** unbinds the handle from its zone, so it does nothing until a zone adopts it again */
    unbind(): void;
}

const zoneToState = new WeakMap<HTMLElement, HandleZoneState>();

// Whether no handle drag is in progress. One store for every handle zone: a drag started from any handle enables every
// handle zone for the drag, so a drag from zone A can move and drop in zone B, and it resets everywhere when the drag
// ends.
const isItemsDragDisabled = createStore(true);

// Handles that found no registered zone when they were attached. Svelte runs the attachments of a zone's children before
// the zone's own attachment, so this is the usual case at mount. The zone adopts them when it is created.
const pendingHandles = new Set<HTMLElement>();
// how a pending handle binds to its zone when the zone adopts it
const pendingHandleToBinding = new WeakMap<HTMLElement, HandleBinding>();

/** The nearest marked handle zone above the element, not the element itself */
function findZoneOf(el: HTMLElement): HTMLElement | null {
    return el.parentElement?.closest<HTMLElement>(`[${HANDLE_ZONE_ATTRIBUTE}]`) ?? null;
}

/**
 * Binds to a new zone the handles whose nearest handle zone it is: pending handles, and handles that an enclosing
 * zone took because this zone had no marker yet when they were attached. That happens when a nested handle zone mounts
 * after its outer zone (Svelte attaches the inner handles before the inner zone, so they find the outer zone).
 */
function adoptHandles(node: HTMLElement, state: HandleZoneState): void {
    for (const handle of Array.from(pendingHandles)) {
        if (node.contains(handle) && findZoneOf(handle) === node) {
            pendingHandles.delete(handle);
            const binding = pendingHandleToBinding.get(handle)!;
            pendingHandleToBinding.delete(handle);
            binding.bind(state);
        }
    }
    for (let outer = findZoneOf(node); outer; outer = findZoneOf(outer)) {
        const outerState = zoneToState.get(outer);
        if (!outerState) continue;
        for (const binding of Array.from(outerState.handles)) {
            if (node.contains(binding.handle) && findZoneOf(binding.handle) === node) binding.bind(state);
        }
    }
}

/**
 * Sets up a dnd zone whose items can only be dragged from their handles. `dragHandleZone` calls it once per element,
 * then calls `update` with the new options each time the getter's state changes.
 *
 * @param node - the element to enhance
 */
export function createHandleZone<T extends object>(
    node: HTMLElement,
    options: Options<T>,
): { update(o: Options<T>): void; destroy(): void } {
    const state: HandleZoneState = {
        userDragDisabled: createStore(options?.dragDisabled ?? false),
        handles: new Set(),
    };
    let currentOptions = options;

    function getAddedOptions(): { dragDisabled: boolean; zoneItemTabIndex: number } {
        return {
            dragDisabled: state.userDragDisabled.get() || isItemsDragDisabled.get(),
            zoneItemTabIndex: -1,
        };
    }

    const zone = createZone(node, {
        ...currentOptions,
        ...getAddedOptions(),
    });

    function updateZone(): void {
        zone.update({
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

    node.setAttribute(HANDLE_ZONE_ATTRIBUTE, "");
    zoneToState.set(node, state);
    adoptHandles(node, state);

    return {
        update: (newOptions: Options<T>) => {
            currentOptions = newOptions;
            // keep store in sync with external prop
            state.userDragDisabled.set(currentOptions?.dragDisabled ?? false);
            updateZone();
        },
        destroy: () => {
            zone.destroy();
            isItemsDragDisabled.unsubscribe(updateZone);
            if (zoneToState.get(node) === state) {
                // a zone created later on this element adopts the handles, as one created before its handles does
                for (const binding of Array.from(state.handles)) {
                    binding.unbind();
                    pendingHandles.add(binding.handle);
                    pendingHandleToBinding.set(binding.handle, binding);
                }
                zoneToState.delete(node);
                node.removeAttribute(HANDLE_ZONE_ATTRIBUTE);
            }
        },
    };
}

/**
 * Makes an element a drag handle of the nearest handle zone it is in. Returns its cleanup.
 *
 * @param handle - an element inside an item of a handle zone
 */
export function attachHandle(handle: HTMLElement): () => void {
    // the zone the handle is bound to, set when it finds its zone at attach time or when a zone adopts it
    let boundState: HandleZoneState | undefined;
    // assigned in startDrag before resetStartDrag is registered, so every read follows an assignment
    let releaseWindow: Window;

    function startDrag(e: MouseEvent | TouchEvent): void {
        // preventing default to prevent lag on touch devices (because of the browser checking for screen scrolling)
        e.preventDefault();
        // a handle of a locked zone starts no drag, so nothing would reset the state every handle zone shares
        if (!boundState || boundState.userDragDisabled.get()) return;
        isItemsDragDisabled.set(false);

        // Reset the startDrag/isItemsDragDisabled if the user releases the mouse/touch without initiating a drag, or if the
        // handle's window goes away first
        releaseWindow = getWindowOf(handle);
        releaseWindow.addEventListener("mouseup", resetStartDrag);
        releaseWindow.addEventListener("touchend", resetStartDrag);
        releaseWindow.addEventListener("pagehide", resetStartDrag);
    }

    function handleKeyDown(e: KeyboardEvent): void {
        if (!boundState || boundState.userDragDisabled.get()) return;
        if (isKeyboardDragTriggerKey(e.key)) isItemsDragDisabled.set(false);
    }

    function resetStartDrag(): void {
        isItemsDragDisabled.set(true);
        releaseWindow.removeEventListener("mouseup", resetStartDrag);
        releaseWindow.removeEventListener("touchend", resetStartDrag);
        releaseWindow.removeEventListener("pagehide", resetStartDrag);
    }

    // dragDisabled of the handle's own zone, plus the drag state that every handle zone shares
    const recomputeHandleState = (): void => {
        const userDisabled = boundState!.userDragDisabled.get();
        const internalDisabled = isItemsDragDisabled.get();

        if (userDisabled) {
            handle.tabIndex = -1;
            handle.style.cursor = ""; // default cursor
        } else {
            handle.tabIndex = internalDisabled ? 0 : -1;
            handle.style.cursor = internalDisabled ? "grab" : "grabbing";
        }
    };

    function unbind(): void {
        if (!boundState) return;
        handle.removeEventListener("mousedown", startDrag);
        handle.removeEventListener("touchstart", startDrag);
        handle.removeEventListener("keydown", handleKeyDown);
        isItemsDragDisabled.unsubscribe(recomputeHandleState);
        boundState.userDragDisabled.unsubscribe(recomputeHandleState);
        boundState.handles.delete(binding);
        boundState = undefined;
    }

    const binding: HandleBinding = {
        handle,
        bind: (state) => {
            const previous = boundState;
            boundState = state;
            if (previous) {
                // a nested zone created after the zone the handle was bound to takes the handle over
                previous.handles.delete(binding);
                previous.userDragDisabled.unsubscribe(recomputeHandleState);
            } else {
                handle.setAttribute("role", "button");
                handle.addEventListener("mousedown", startDrag);
                handle.addEventListener("touchstart", startDrag);
                handle.addEventListener("keydown", handleKeyDown);
                isItemsDragDisabled.subscribe(recomputeHandleState);
            }
            state.handles.add(binding);
            // subscribe runs recomputeHandleState, so the handle shows its new zone's state at once
            state.userDragDisabled.subscribe(recomputeHandleState);
        },
        unbind,
    };

    const zone = findZoneOf(handle);
    const state = zone && zoneToState.get(zone);
    if (state) {
        binding.bind(state);
    } else {
        pendingHandles.add(handle);
        pendingHandleToBinding.set(handle, binding);
    }

    return () => {
        if (pendingHandles.delete(handle)) {
            pendingHandleToBinding.delete(handle);
            printDebug(() => ["dragHandle found no dragHandleZone, so it did nothing", handle]);
        }
        unbind();
    };
}

/** For tests only: how many handles wait for their zone */
export function _pendingHandleCount(): number {
    return pendingHandles.size;
}

/**
 * Turns the element into a dnd zone whose items can only be dragged from their drag handles. Mark the handle inside
 * each item with `{@attach dragHandle}`. `dragDisabled` applies to this zone's handles only.
 * Credit for the idea and initial implementation goes to @gleuch (Greg Leuch) and @geovie (Georg Vienna)
 *
 * @param getOptions - returns the zone's options, the same as for `dndzone`
 * @example
 * ```svelte
 * <ul {@attach dragHandleZone(() => ({ items, onconsider: update, onfinalize: update }))}>
 *     {#each items as item (item.id)}
 *         <li><span {@attach dragHandle}>::</span> {item.name}</li>
 *     {/each}
 * </ul>
 * ```
 */
export function dragHandleZone<T extends object>(getOptions: () => Options<T>): Attachment<HTMLElement> {
    return fromAction(createHandleZone<T>, () => readOptions(getOptions));
}

/**
 * Marks a drag handle inside an item of a `dragHandleZone`. Use it as `{@attach dragHandle}`. The handle belongs to the
 * nearest handle zone around it, gets `role="button"`, and starts a drag with the pointer or the keyboard drag
 * trigger. A handle outside of any handle zone does nothing.
 */
export const dragHandle: Attachment<HTMLElement> = attachHandle;
