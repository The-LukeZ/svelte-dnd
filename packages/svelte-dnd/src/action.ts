import { dndzone as pointerDndZone } from "./pointerAction";
import { dndzone as keyboardDndZone } from "./keyboardAction";
import { ITEM_ID_KEY, SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME } from "./constants";
import { getWindowOf, toString } from "./helpers/util";
import { untrack } from "svelte";
import { fromAction } from "svelte/attachments";
import type { Attachment } from "svelte/attachments";
import type { Options } from "./types";

/**
 * Turns any container into a dnd zone and all of its direct children into draggables.
 * Supports mouse, touch and keyboard interactions.
 * Calls the onconsider and onfinalize options, which the container is expected to react to by reassigning its list of
 * items, which then feeds back into the zone through the options getter.
 *
 * @param getOptions - returns the zone's options. It runs again whenever the state it reads changes, such as `items`
 * or a top-level property of a `$state` options object that it returns
 * @example
 * ```svelte
 * <ul {@attach dndzone(() => ({ items, onconsider: update, onfinalize: update }))}>
 * ```
 */
export function dndzone<T extends object>(getOptions: () => Options<T>): Attachment<HTMLElement> {
    return fromAction(updateOnceRendered(createZone<T>), () => readOptions(getOptions));
}

/**
 * Wraps a zone factory for an attachment, so each update reaches the zone once Svelte has rendered the new items.
 * The engine styles the zone's children by their index in the items, so the children must show those items already.
 * On a regular element the attachment's update runs after the element's children update, but on a <svelte:element>
 * Svelte runs it before them, and the shadow item's styling lands on the wrong child and stays there
 * (upstream isaacHagoel/svelte-dnd-action#640). A microtask runs once the current flush, children included, is done.
 * Every update waits, as the DOM cannot tell whether the children show the items yet: when a drag starts, the shadow
 * item takes the dragged item's place, and the number of children stays the same.
 * The options are still validated right away, so a bad option throws where it is given. The zone then applies them
 * without validating them again. An error the zone throws while it applies them has no caller in the microtask, and
 * goes to the window's error event (reportError).
 */
export function updateOnceRendered<T extends object>(
    create: (node: HTMLElement, options: Options<T>) => Zone<T>,
): (node: HTMLElement, options: Options<T>) => Zone<T> {
    return (node, options) => deferUpdates(node, create(node, options));
}

function deferUpdates<T extends object>(node: HTMLElement, zone: Zone<T>): Zone<T> {
    const updateValidated = zone[UPDATE_VALIDATED] ?? zone.update;
    let pendingOptions: Options<T> | undefined;
    let destroyed = false;
    const applyPending = (): void => {
        const next = pendingOptions;
        pendingOptions = undefined;
        if (destroyed || !next) return;
        try {
            updateValidated(next);
        } catch (err) {
            // the microtask has no caller to throw to
            getWindowOf(node).reportError(err);
        }
    };
    return {
        update: (newOptions: Options<T>) => {
            untrack(() => validateOptions(newOptions));
            const isScheduled = pendingOptions !== undefined;
            pendingOptions = newOptions;
            if (!isScheduled) queueMicrotask(applyPending);
        },
        destroy: () => {
            destroyed = true;
            pendingOptions = undefined;
            zone.destroy();
        },
    };
}

/**
 * Calls the getter and copies the top level of what it returns, so the effect that runs the getter tracks each option
 * it reads. A getter such as `() => options`, where `options` is a `$state` object that is never reassigned, reads no
 * signal by itself, and the zone would never see `options.items = e.items`. The copy reads every property, which
 * subscribes the effect to them. Writes deeper down, such as `options.items.push(item)`, stay unseen, the same as for
 * an `items` array: reassign the property instead.
 */
export function readOptions<T extends object>(getOptions: () => Options<T>): Options<T> {
    return { ...getOptions() };
}

/**
 * The zone's update for options that were validated already. updateOnceRendered validates them when they are given,
 * and applies them with this later, so they are validated once.
 */
export const UPDATE_VALIDATED: unique symbol = Symbol("updateValidated");

export type Zone<T extends object> = {
    update(o: Options<T>): void;
    destroy(): void;
    [UPDATE_VALIDATED]?: (o: Options<T>) => void;
};
type ValidatingZone<T extends object> = Zone<T> & { [UPDATE_VALIDATED]: (o: Options<T>) => void };

/**
 * Sets up the pointer and keyboard zones on a node. `dndzone` calls it once per element, then calls `update` with the
 * new options each time the getter's state changes.
 * A node inside an element marked with the shadow hint waits: it gets no zone while the hint is set, and the real zone
 * once the hint is removed. The shadow item's element stays as the dropped item's element after a drop, so its nested
 * zone comes to life then (https://github.com/The-LukeZ/svelte-dnd/issues/7).
 *
 * @param node - the element to enhance
 */
export function createZone<T extends object>(node: HTMLElement, options: Options<T>): ValidatingZone<T> {
    let zone: ValidatingZone<T> | undefined;
    let observer: MutationObserver | undefined;

    const hinted = closestHintedAncestor(node);
    if (!hinted) {
        zone = createLiveZone(node, options);
        return zone;
    }

    // A waiting zone validates its options like a live one, so errors and warnings show where the options are given,
    // and the zone is set up later only with options that passed.
    validateOptions(options);
    let latestOptions = options;
    let watched = hinted;
    const setUp = (): void => {
        try {
            zone = createLiveZone(node, latestOptions);
        } catch (err) {
            // the observer callback has no caller to throw to; the next update tries again
            getWindowOf(node).reportError(err);
        }
    };
    observer = new MutationObserver(() => {
        const next = closestHintedAncestor(node);
        if (next) {
            // the hint moved to another ancestor: watch that one instead
            if (next !== watched) {
                observer!.disconnect();
                watched = next;
                observer!.observe(watched, { attributeFilter: [SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME] });
            }
            return;
        }
        observer!.disconnect();
        observer = undefined;
        setUp();
    });
    observer.observe(watched, { attributeFilter: [SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME] });

    const updateValidated = (newOptions: Options<T>): void => {
        if (zone) {
            zone[UPDATE_VALIDATED](newOptions);
            return;
        }
        latestOptions = newOptions;
        // the hint is gone but setting up failed: try again with the new options
        if (!observer) {
            untrack(setUp);
        }
    };
    return {
        update: (newOptions: Options<T>) => {
            untrack(() => validateOptions(newOptions));
            updateValidated(newOptions);
        },
        [UPDATE_VALIDATED]: updateValidated,
        destroy: () => {
            observer?.disconnect();
            observer = undefined;
            zone?.destroy();
            zone = undefined;
        },
    };
}

function createLiveZone<T extends object>(node: HTMLElement, options: Options<T>): ValidatingZone<T> {
    validateOptions(options);
    const pointerZone = pointerDndZone(node, toEngineOptions(options));
    const keyboardZone = keyboardDndZone(node, toEngineOptions(options));
    // fromAction calls the update inside an effect. Untracked, so the engine's reads of the options (copying items,
    // the id check) add no dependencies: the zone updates only when what the getter reads changes.
    const updateValidated = (newOptions: Options<T>): void =>
        untrack(() => {
            pointerZone.update(toEngineOptions(newOptions));
            keyboardZone.update(toEngineOptions(newOptions));
        });
    return {
        update: (newOptions: Options<T>) => {
            untrack(() => validateOptions(newOptions));
            updateValidated(newOptions);
        },
        [UPDATE_VALIDATED]: updateValidated,
        destroy: () => {
            pointerZone.destroy();
            keyboardZone.destroy();
        },
    };
}

/**
 * The engine boundary. The engine reads an item only through its id key, which validateOptions checks, and the shadow
 * marker it sets itself. It hands the zone's items and the dragged item's data back to the zone's own callbacks and
 * transformDraggedElement, so they receive the zone's own T while the engine works on its Item shape.
 */
function toEngineOptions<T extends object>(options: Options<T>): Options {
    return options as unknown as Options;
}

/**
 * The closest element, the node included, that the user marked as the shadow item, if any.
 * A zone nested in the shadow item is created like any other under Svelte 5, and would register a duplicate zone for
 * the length of the drag. The engine cannot tell from the DOM which element is the shadow one at that point, so the user
 * marks it. test/svelte/shadowHint.test.ts shows the nested zone is set up without the mark, skipped with it, and set up
 * once the mark is gone after the drop.
 */
function closestHintedAncestor(node: HTMLElement): Element | null {
    return node.closest(`[${SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME}="true"]`);
}

function validateOptions<T extends object>(options: Options<T>): void {
    /*eslint-disable*/
    const {
        items,
        flipDurationMs,
        type,
        dragDisabled,
        keyboardDragDisabled,
        morphDisabled,
        dropFromOthersDisabled,
        zoneTabIndex,
        zoneItemTabIndex,
        dropTargetStyle,
        dropTargetClasses,
        transformDraggedElement,
        autoAriaDisabled,
        centreDraggedOnCursor,
        lockAxis,
        useCursorForDetection,
        delayTouchStart,
        dropAnimationDisabled,
        useComputedStyleForRects,
        onconsider,
        onfinalize,
        ...rest
    } = options;
    /*eslint-enable*/
    if (Object.keys(rest).length > 0) {
        console.warn(`dndzone will ignore unknown options`, rest);
    }
    if (!items) {
        throw new Error("no 'items' key provided to dndzone");
    }
    if (!Array.isArray(items)) {
        throw new Error(
            `dndzone expects 'items' to be an array but instead it is a ${typeof items}, ${toString(items)}`,
        );
    }
    // an item that is not an object (null, a number) has no id either, and would make `in` throw a TypeError
    // `in` and not hasOwnProperty: an id the item inherits, like a getter on its class (RxDB documents), counts too
    const missingIdIdx = items.findIndex((item) => typeof item !== "object" || item === null || !(ITEM_ID_KEY in item));
    if (missingIdIdx !== -1) {
        throw new Error(
            `missing '${ITEM_ID_KEY}' property for item ${toString(items[missingIdIdx])} at index ${missingIdIdx}. ` +
                `Every item needs a unique '${ITEM_ID_KEY}', or set the name of the id property with configure({ idKey }).`,
        );
    }
    if (dropTargetClasses && !Array.isArray(dropTargetClasses)) {
        throw new Error(
            `dropTargetClasses should be an array but instead it is a ${typeof dropTargetClasses}, ${toString(dropTargetClasses)}`,
        );
    }
    if (zoneTabIndex && !isInt(zoneTabIndex)) {
        throw new Error(
            `zoneTabIndex should be a number but instead it is a ${typeof zoneTabIndex}, ${toString(zoneTabIndex)}`,
        );
    }
    if (zoneItemTabIndex && !isInt(zoneItemTabIndex)) {
        throw new Error(
            `zoneItemTabIndex should be a number but instead it is a ${typeof zoneItemTabIndex}, ${toString(zoneItemTabIndex)}`,
        );
    }
    if (onconsider !== undefined && typeof onconsider !== "function") {
        throw new Error(
            `onconsider should be a function but instead it is a ${typeof onconsider}, ${toString(onconsider)}`,
        );
    }
    if (onfinalize !== undefined && typeof onfinalize !== "function") {
        throw new Error(
            `onfinalize should be a function but instead it is a ${typeof onfinalize}, ${toString(onfinalize)}`,
        );
    }
    if (lockAxis !== undefined && lockAxis !== "x" && lockAxis !== "y") {
        throw new Error(`lockAxis should be "x" or "y" but instead it is a ${typeof lockAxis}, ${toString(lockAxis)}`);
    }
    if (keyboardDragDisabled !== undefined && typeof keyboardDragDisabled !== "boolean") {
        throw new Error(
            `keyboardDragDisabled should be a boolean but instead it is a ${typeof keyboardDragDisabled}, ${toString(keyboardDragDisabled)}`,
        );
    }
    if (useComputedStyleForRects !== undefined && typeof useComputedStyleForRects !== "boolean") {
        throw new Error(
            `useComputedStyleForRects should be a boolean but instead it is a ${typeof useComputedStyleForRects}, ${toString(useComputedStyleForRects)}`,
        );
    }
    if (delayTouchStart !== undefined && delayTouchStart !== false) {
        const validBoolean = delayTouchStart === true;
        const validNumber = typeof delayTouchStart === "number" && isFinite(delayTouchStart) && delayTouchStart >= 0;
        if (!validBoolean && !validNumber) {
            throw new Error(
                `delayTouchStart should be a boolean (true/false) or a non-negative number but instead it is a ${typeof delayTouchStart}, ${toString(
                    delayTouchStart,
                )}`,
            );
        }
    }
}

function isInt(value: number): boolean {
    // parseFloat converts a number argument to a string at runtime; lib.es5 declares only a string parameter
    return (
        !isNaN(value) &&
        (function (x) {
            return (x | 0) === x;
        })(parseFloat(value as unknown as string))
    );
}
