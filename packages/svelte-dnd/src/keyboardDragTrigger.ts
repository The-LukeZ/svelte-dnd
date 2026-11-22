import { DEFAULT_KEYBOARD_DRAG_TRIGGER, KEYBOARD_DRAG_TRIGGER_KEYS } from "./constants";
import { toString } from "./helpers/util";
import { setInstructionContext } from "./helpers/aria";

type KeyboardDragTrigger = "space" | "enter" | "space_or_enter";

let activeTrigger: KeyboardDragTrigger = DEFAULT_KEYBOARD_DRAG_TRIGGER;

/**
 * Chooses which key(s) start and stop a keyboard drag on a focused item. Keys outside the trigger are left
 * completely untouched by the library, so the app can use them - ex: "space" keeps Enter free to activate the
 * focused item. Set through configure({ keyboardDragTrigger }). This is global and applies to all dndzones. It can be called at any time.
 * Untouched means no preventDefault and no stopPropagation. This setting is global to the document.
 * Pass null or undefined (or call with no argument) to restore the default, "space_or_enter".
 * @throws {Error} if given anything other than the documented values, null, or undefined
 */
export function setKeyboardDragTrigger(trigger?: KeyboardDragTrigger | null): void {
    if (trigger === null || trigger === undefined) {
        activeTrigger = DEFAULT_KEYBOARD_DRAG_TRIGGER;
    } else if (
        typeof trigger !== "string" ||
        !Object.prototype.hasOwnProperty.call(KEYBOARD_DRAG_TRIGGER_KEYS, trigger)
    ) {
        throw new Error(
            `configure({ keyboardDragTrigger }) expects one of ${Object.keys(KEYBOARD_DRAG_TRIGGER_KEYS)
                .map((key) => `"${key}"`)
                .join(", ")} or null but instead got a ${typeof trigger}, ${toString(trigger)}`,
        );
    } else {
        activeTrigger = trigger;
    }
    setInstructionContext({ keyboardDragTrigger: activeTrigger });
}

/**
 * @return the active trigger
 */
export function getKeyboardDragTrigger(): KeyboardDragTrigger {
    return activeTrigger;
}

/**
 * @param key - a KeyboardEvent.key value
 * @return whether this key starts/stops a drag under the active trigger
 */
export function isKeyboardDragTriggerKey(key: string): boolean {
    return KEYBOARD_DRAG_TRIGGER_KEYS[activeTrigger].includes(key);
}
