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
 * @example
 * ```svelte
 * <ul {@attach dndzone(() => ({ items, onconsider: update, onfinalize: update }))}>
 * ```
 */
export function dndzone<T extends object>(getOptions: () => Options<T>): Attachment<HTMLElement> {
    return fromAction(createZone<T>, getOptions);
}

/**
 * Sets up the pointer and keyboard zones on a node. `dndzone` calls it once per element, then calls `update` with the
 * new options each time the getter's state changes.
 *
 * @param node - the element to enhance
 */
export function createZone<T extends object>(
    node: HTMLElement,
    options: Options<T>,
): { update(o: Options<T>): void; destroy(): void } {
    if (shouldIgnoreZone(node)) {
        return {
            update: () => {},
            destroy: () => {},
        };
    }
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
 * If the user marked something in the ancestry of our node as shadow element, we can ignore it.
 * The check is still needed under Svelte 5: a zone nested in the shadow item is created like any other, and would
 * register a duplicate zone for the length of the drag. The engine cannot tell from the DOM which element is the shadow
 * one at that point, so the user marks it. test/svelte/shadowHint.test.ts shows the nested zone is set up without the
 * mark and skipped with it.
 */
function shouldIgnoreZone(node: HTMLElement): boolean {
    return !!node.closest(`[${SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME}="true"]`);
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
