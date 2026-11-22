import { dndzone as pointerDndZone } from "./pointerAction";
import { dndzone as keyboardDndZone } from "./keyboardAction";
import { ITEM_ID_KEY, SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME } from "./constants";
import { toString } from "./helpers/util";
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
    return fromAction(createZone<T>, () => readOptions(getOptions));
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

type Zone<T extends object> = { update(o: Options<T>): void; destroy(): void };

/**
 * Sets up the pointer and keyboard zones on a node. `dndzone` calls it once per element, then calls `update` with the
 * new options each time the getter's state changes.
 * A node inside an element marked with the shadow hint waits: it gets no zone while the hint is set, and the real zone
 * once the hint is removed. The shadow item's element stays as the dropped item's element after a drop, so its nested
 * zone comes to life then (https://github.com/The-LukeZ/svelte-dnd/issues/7).
 *
 * @param node - the element to enhance
 */
export function createZone<T extends object>(node: HTMLElement, options: Options<T>): Zone<T> {
    let latestOptions = options;
    let zone: Zone<T> | undefined;
    let observer: MutationObserver | undefined;

    const hinted = closestHintedAncestor(node);
    if (hinted) {
        let watched = hinted;
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
            zone = createLiveZone(node, latestOptions);
        });
        observer.observe(watched, { attributeFilter: [SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME] });
    } else {
        zone = createLiveZone(node, options);
    }

    return {
        update: (newOptions: Options<T>) => {
            latestOptions = newOptions;
            zone?.update(newOptions);
        },
        destroy: () => {
            observer?.disconnect();
            observer = undefined;
            zone?.destroy();
            zone = undefined;
        },
    };
}

function createLiveZone<T extends object>(node: HTMLElement, options: Options<T>): Zone<T> {
    validateOptions(options);
    const pointerZone = pointerDndZone(node, toEngineOptions(options));
    const keyboardZone = keyboardDndZone(node, toEngineOptions(options));
    return {
        update: (newOptions: Options<T>) => {
            // fromAction calls this inside an effect. Untracked, so the engine's reads of the options (copying items,
            // the id check) add no dependencies: the zone updates only when what the getter reads changes.
            untrack(() => {
                validateOptions(newOptions);
                pointerZone.update(toEngineOptions(newOptions));
                keyboardZone.update(toEngineOptions(newOptions));
            });
        },
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
        morphDisabled,
        dropFromOthersDisabled,
        zoneTabIndex,
        zoneItemTabIndex,
        dropTargetStyle,
        dropTargetClasses,
        transformDraggedElement,
        autoAriaDisabled,
        centreDraggedOnCursor,
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
    const itemWithMissingId = items.find((item) => !{}.hasOwnProperty.call(item, ITEM_ID_KEY));
    if (itemWithMissingId) {
        throw new Error(`missing '${ITEM_ID_KEY}' property for item ${toString(itemWithMissingId)}`);
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
