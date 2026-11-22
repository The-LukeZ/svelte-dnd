import { overrideItemIdKeyNameBeforeInitialisingDndZones, setDebugMode } from "./constants";
import { setAriaStrings } from "./helpers/aria";
import { setKeyboardDragTrigger } from "./keyboardDragTrigger";
import type { DndConfig } from "./types";

const CONFIG_KEYS = ["idKey", "keyboardDragTrigger", "ariaStrings", "debug"];

/**
 * Sets the global settings of the library. Keys that are left out (or undefined) are not touched.
 * It only sets module state and touches no DOM, so it is safe to call during SSR.
 * Every key keeps the validation and the side effects of the setting it applies:
 * - idKey throws when a zone is mounted or the value is not a string
 * - keyboardDragTrigger: null restores "space_or_enter"; it updates the screen-reader instructions
 * - ariaStrings: null restores the English strings; existing instruction elements update immediately
 * - debug turns console.debug output on or off
 * @throws {Error} on an unknown key, which is checked before any key is applied, or when a value is invalid
 */
export function configure(config: DndConfig): void {
    const unknownKeys = Object.keys(config).filter((key) => !CONFIG_KEYS.includes(key));
    if (unknownKeys.length > 0) {
        throw new Error(
            `Can't configure unknown key ${unknownKeys.join(", ")}! Supported keys: ${CONFIG_KEYS.join(", ")}`,
        );
    }
    const { idKey, keyboardDragTrigger, ariaStrings, debug } = config;
    if (idKey !== undefined) overrideItemIdKeyNameBeforeInitialisingDndZones(idKey);
    if (keyboardDragTrigger !== undefined) setKeyboardDragTrigger(keyboardDragTrigger);
    if (ariaStrings !== undefined) setAriaStrings(ariaStrings);
    if (debug !== undefined) setDebugMode(debug);
}
