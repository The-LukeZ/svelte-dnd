import { assertValidIdKey, overrideItemIdKeyNameBeforeInitialisingDndZones, setDebugMode } from "./constants";
import { assertValidAriaStrings, setAriaStrings } from "./helpers/aria";
import { assertValidKeyboardDragTrigger, setKeyboardDragTrigger } from "./keyboardDragTrigger";
import { toString } from "./helpers/util";
import { assertValidAutoScrollPx, setAutoScrollEdgePx, setAutoScrollMaxStepPx } from "./helpers/scroller";
import type { DndConfig } from "./types";

const CONFIG_KEYS = ["idKey", "keyboardDragTrigger", "ariaStrings", "debug", "autoScrollEdgePx", "autoScrollMaxStepPx"];

/**
 * Sets the global settings of the library. Keys that are left out (or undefined) are not touched.
 * It only sets module state and touches no DOM, so it is safe to call during SSR.
 * Every key keeps the validation and the side effects of the setting it applies:
 * - idKey throws when a zone is mounted or the value is not a string
 * - keyboardDragTrigger: null restores "space_or_enter"; it updates the screen-reader instructions
 * - ariaStrings: null restores the English strings; existing instruction elements update immediately
 * - debug turns console.debug output on or off, and has to be a boolean
 * - autoScrollEdgePx and autoScrollMaxStepPx have to be positive numbers; null restores the default, 30
 * @throws {Error} on an unknown key or an invalid value. Keys and values are all checked before any key is applied,
 * so a call that throws changes nothing.
 */
export function configure(config: DndConfig): void {
    const unknownKeys = Object.keys(config).filter((key) => !CONFIG_KEYS.includes(key));
    if (unknownKeys.length > 0) {
        throw new Error(
            `Can't configure unknown key ${unknownKeys.join(", ")}! Supported keys: ${CONFIG_KEYS.join(", ")}`,
        );
    }
    const { idKey, keyboardDragTrigger, ariaStrings, debug, autoScrollEdgePx, autoScrollMaxStepPx } = config;
    if (idKey !== undefined) assertValidIdKey(idKey);
    if (keyboardDragTrigger !== undefined) assertValidKeyboardDragTrigger(keyboardDragTrigger);
    if (ariaStrings !== undefined) assertValidAriaStrings(ariaStrings);
    if (debug !== undefined && typeof debug !== "boolean") {
        throw new Error(`configure({ debug }) expects a boolean but instead got a ${typeof debug}, ${toString(debug)}`);
    }
    assertValidAutoScrollPx("autoScrollEdgePx", autoScrollEdgePx);
    assertValidAutoScrollPx("autoScrollMaxStepPx", autoScrollMaxStepPx);
    if (idKey !== undefined) overrideItemIdKeyNameBeforeInitialisingDndZones(idKey);
    if (keyboardDragTrigger !== undefined) setKeyboardDragTrigger(keyboardDragTrigger);
    if (ariaStrings !== undefined) setAriaStrings(ariaStrings);
    if (debug !== undefined) setDebugMode(debug);
    if (autoScrollEdgePx !== undefined) setAutoScrollEdgePx(autoScrollEdgePx);
    if (autoScrollMaxStepPx !== undefined) setAutoScrollMaxStepPx(autoScrollMaxStepPx);
}
