import { dndzone as pointerDndZone } from "./pointerAction";
import { dndzone as keyboardDndZone } from "./keyboardAction";
import { ITEM_ID_KEY, SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME } from "./constants";
import { toString } from "./helpers/util";
import type { ActionReturn } from "svelte/action";
import type { DndZoneAttributes, Item, Options } from "./types";

/**
 * A custom action to turn any container to a dnd zone and all of its direct children to draggables
 * Supports mouse, touch and keyboard interactions.
 * Calls the onconsider and onfinalize options, which the container is expected to react to by modifying its list of
 * items, which will then feed back in to this action via the update function
 *
 * @param node - the element to enhance
 */
export function dndzone<T extends Item>(
    node: HTMLElement,
    options: Options<T>,
): ActionReturn<Options<T>, DndZoneAttributes<T>> {
    if (shouldIgnoreZone(node)) {
        return {
            update: () => {},
            destroy: () => {},
        };
    }
    validateOptions(options);
    const pointerZone = pointerDndZone(node, options);
    const keyboardZone = keyboardDndZone(node, options);
    return {
        update: (newOptions: Options<T>) => {
            validateOptions(newOptions);
            pointerZone.update(newOptions);
            keyboardZone.update(newOptions);
        },
        destroy: () => {
            pointerZone.destroy();
            keyboardZone.destroy();
        },
    };
}

/**
 * If the user marked something in the ancestry of our node as shadow element, we can ignore it
 * We need the user to mark it for us because svelte updates the action from deep to shallow (but renders top down)
 */
function shouldIgnoreZone(node: HTMLElement): boolean {
    return !!node.closest(`[${SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME}="true"]`);
}

function validateOptions<T extends Item>(options: Options<T>): void {
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
