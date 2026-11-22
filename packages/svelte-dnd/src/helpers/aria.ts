import { DEFAULT_KEYBOARD_DRAG_TRIGGER, KEYBOARD_DRAG_TRIGGER_PHRASES, isOnServer, printDebug } from "../constants";
import { toString } from "./util";
import type { AriaStrings } from "../types";

const INSTRUCTION_IDs = {
    DND_ZONE_ACTIVE: "dnd-zone-active",
    DND_ZONE_DRAG_DISABLED: "dnd-zone-drag-disabled",
};
type InstructionStringKey = "zoneActiveInstruction" | "zoneDragDisabledInstruction";
type InstructionContext = { keyboardDragTrigger: "space" | "enter" | "space_or_enter" };

const INSTRUCTION_ID_TO_STRING_KEY: Record<string, InstructionStringKey> = {
    [INSTRUCTION_IDs.DND_ZONE_ACTIVE]: "zoneActiveInstruction",
    [INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED]: "zoneDragDisabledInstruction",
};

const DEFAULT_ARIA_STRINGS: Required<AriaStrings> = {
    dragStarted: ({ itemLabel, zoneLabel, canMoveBetweenZones }) =>
        `Started dragging item ${itemLabel}. Use the arrow keys to move it within its list ${zoneLabel}` +
        (canMoveBetweenZones ? ", or tab to another list in order to move the item into it" : ""),
    movedToPosition: ({ itemLabel, zoneLabel, position }) =>
        `Moved item ${itemLabel} to position ${position} in the list ${zoneLabel}`,
    movedToZoneEnd: ({ itemLabel, zoneLabel }) => `Moved item ${itemLabel} to the end of the list ${zoneLabel}`,
    movedToZoneStart: ({ itemLabel, zoneLabel }) => `Moved item ${itemLabel} to the beginning of the list ${zoneLabel}`,
    dropped: ({ itemLabel }) => `Stopped dragging item ${itemLabel}`,
    zoneActiveInstruction: ({ keyboardDragTrigger }) =>
        `Tab to one the items and press ${KEYBOARD_DRAG_TRIGGER_PHRASES[keyboardDragTrigger]} to start dragging it`,
    zoneDragDisabledInstruction: "This is a disabled drag and drop list",
};

const FUNCTION_ARIA_STRING_KEYS = ["dragStarted", "movedToPosition", "movedToZoneEnd", "movedToZoneStart", "dropped"];
// zoneActiveInstruction names the key that starts a drag, so a translation may need to vary it with the trigger.
const STRING_OR_FUNCTION_ARIA_STRING_KEYS = ["zoneActiveInstruction"];
// zoneDragDisabledInstruction has no drag to start and thus no key to name, so it stays string-only.
const STRING_ONLY_ARIA_STRING_KEYS = ["zoneDragDisabledInstruction"];

let ariaStrings: Required<AriaStrings> = { ...DEFAULT_ARIA_STRINGS };
let instructionCtx: InstructionContext = { keyboardDragTrigger: DEFAULT_KEYBOARD_DRAG_TRIGGER };

const ALERT_DIV_ID = "dnd-action-aria-alert";
// A map from a document to its alerts div. A zone can live in another window than the one that loaded this module, so each
// document with zones gets its own alerts and instructions. It is a Map rather than a WeakMap so the instructions in every
// document can be re-rendered; destroyAria removes the entry.
const docToAlertsDiv = new Map<Document, HTMLDivElement>();

function initAriaOnBrowser(doc: Document): void {
    if (docToAlertsDiv.has(doc)) {
        // it is already initialized
        return;
    }
    // setting the dynamic alerts
    const alertsDiv = doc.createElement("div");
    (function initAlertsDiv() {
        alertsDiv.id = ALERT_DIV_ID;
        // tab index -1 makes the alert be read twice on chrome for some reason
        //alertsDiv.tabIndex = -1;
        alertsDiv.style.position = "fixed";
        alertsDiv.style.bottom = "0";
        alertsDiv.style.left = "0";
        alertsDiv.style.zIndex = "-5";
        alertsDiv.style.opacity = "0";
        alertsDiv.style.height = "0";
        alertsDiv.style.width = "0";
        alertsDiv.setAttribute("role", "alert");
    })();
    doc.body.prepend(alertsDiv);
    // forget the documents whose window is gone
    docToAlertsDiv.forEach((_, knownDoc) => !knownDoc.defaultView && docToAlertsDiv.delete(knownDoc));
    docToAlertsDiv.set(doc, alertsDiv);

    // setting the instructions
    Object.entries(INSTRUCTION_ID_TO_STRING_KEY).forEach(([id, key]) =>
        doc.body.prepend(instructionToHiddenDiv(doc, id, formatWithFallback(key, instructionCtx))),
    );
}

/**
 * Initializes the static aria instructions so they can be attached to zones
 * @param doc - the document of the zones, defaults to the one that loaded this module
 * @return the IDs for static aria instruction (to be used via aria-describedby) or null on the server
 */
export function initAria(doc?: Document): { DND_ZONE_ACTIVE: string; DND_ZONE_DRAG_DISABLED: string } | null {
    if (isOnServer) return null;
    // eslint-disable-next-line no-restricted-globals -- the documented default
    doc = doc || document;
    // "interactive" means the body is parsed. Firefox reports it after document.close() on a written document, where
    // DOMContentLoaded has already fired: https://github.com/The-LukeZ/svelte-dnd/issues/2
    if (doc.readyState !== "loading") {
        initAriaOnBrowser(doc);
    } else {
        doc.addEventListener("DOMContentLoaded", () => initAriaOnBrowser(doc));
    }
    return { ...INSTRUCTION_IDs };
}

/**
 * Removes all the artifacts (dom elements) added by this module to the given document
 * @param doc - defaults to the document that loaded this module
 */
export function destroyAria(doc?: Document): void {
    if (isOnServer) return;
    // eslint-disable-next-line no-restricted-globals -- the documented default
    doc = doc || document;
    const alertsDiv = docToAlertsDiv.get(doc);
    if (!alertsDiv) return;
    Object.keys(INSTRUCTION_ID_TO_STRING_KEY).forEach((id) => doc.getElementById(id)?.remove());
    alertsDiv.remove();
    docToAlertsDiv.delete(doc);
}

function instructionToHiddenDiv(doc: Document, id: string, txt: string): HTMLDivElement {
    const div = doc.createElement("div");
    div.id = id;
    renderInstruction(div, txt);
    div.style.display = "none";
    div.style.position = "fixed";
    div.style.zIndex = "-5";
    return div;
}

function renderInstruction(div: HTMLElement, txt: string): void {
    div.replaceChildren();
    const paragraph = div.ownerDocument.createElement("p");
    paragraph.textContent = txt;
    div.appendChild(paragraph);
}

/**
 * Will make the screen reader alert the provided text to the user
 * @param doc - the document to announce in, for a zone in another window such as an iframe or a popup.
 * Defaults to the document that loaded the library.
 */
export function alertToScreenReader(txt: string, doc?: Document): void {
    if (isOnServer) return;
    // eslint-disable-next-line no-restricted-globals -- the documented default
    doc = doc || document;
    if (!docToAlertsDiv.has(doc)) {
        initAriaOnBrowser(doc);
    }
    // initAriaOnBrowser above registered the document if it was missing
    const alertsDiv = docToAlertsDiv.get(doc)!;
    alertsDiv.innerHTML = "";
    const alertText = doc.createTextNode(txt);
    alertsDiv.appendChild(alertText);
    // this is needed for Safari
    alertsDiv.style.display = "none";
    alertsDiv.style.display = "inline";
}

/**
 * Overrides the strings the library speaks to screen readers. Merges over the built-in English defaults,
 * so each call describes a whole locale rather than patching the previous one - anything a call leaves
 * out goes back to English.
 * This is global and applies to all dndzones.
 * Pass null to restore the built-in English strings.
 * Existing instruction elements update immediately.
 * Overrides can be any subset of: dragStarted, movedToPosition, movedToZoneEnd,
 * movedToZoneStart, dropped (functions taking a context object and returning a string);
 * zoneActiveInstruction (a string, or a function taking {keyboardDragTrigger} and returning a string -
 * useful because a hard-coded translation can't name the right key if the app varies the trigger);
 * zoneDragDisabledInstruction (a string only - a disabled zone has no drag to start, so there is no key
 * for a formatter to name).
 * Validation completes before the active strings change.
 * @throws {Error} if overrides is not an object or null, contains an unknown key, or contains a value of
 * the wrong type.
 */
export function setAriaStrings(overrides: AriaStrings | null): void {
    if (overrides === null || overrides === undefined) {
        ariaStrings = { ...DEFAULT_ARIA_STRINGS };
    } else {
        if (typeof overrides !== "object" || Array.isArray(overrides)) {
            throw new Error(
                `configure({ ariaStrings }) expects an object or null but instead got a ${typeof overrides}, ${toString(overrides)}`,
            );
        }
        Object.keys(overrides).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_ARIA_STRINGS, key)) {
                throw new Error(
                    `Can't set non existing aria string ${key}! Supported strings: ${Object.keys(DEFAULT_ARIA_STRINGS)}`,
                );
            }
            // the keys were validated against DEFAULT_ARIA_STRINGS above and the value types are checked right below
            const value = (overrides as Record<string, unknown>)[key];
            if (FUNCTION_ARIA_STRING_KEYS.includes(key) && typeof value !== "function") {
                throw new Error(`${key} should be a function but instead it is a ${typeof value}, ${toString(value)}`);
            }
            if (
                STRING_OR_FUNCTION_ARIA_STRING_KEYS.includes(key) &&
                typeof value !== "string" &&
                typeof value !== "function"
            ) {
                throw new Error(
                    `${key} should be a string or a function but instead it is a ${typeof value}, ${toString(value)}`,
                );
            }
            if (STRING_ONLY_ARIA_STRING_KEYS.includes(key) && typeof value !== "string") {
                throw new Error(`${key} should be a string but instead it is a ${typeof value}, ${toString(value)}`);
            }
        });
        ariaStrings = { ...DEFAULT_ARIA_STRINGS, ...overrides };
    }
    refreshInstructions();
}

function formatAriaString(strings: Required<AriaStrings>, key: keyof AriaStrings, ctx: unknown): string {
    const ariaString = strings[key];
    // ctx is the context object that matches key, which announceToScreenReader's callers provide
    return typeof ariaString === "function" ? (ariaString as (ctx: unknown) => string)(ctx) : ariaString;
}

function formatWithFallback(key: keyof AriaStrings, ctx: unknown): string {
    try {
        return formatAriaString(ariaStrings, key, ctx);
    } catch (err) {
        printDebug(() => [`aria string formatter for "${key}" threw, falling back to the default`, err]);
        try {
            return formatAriaString(DEFAULT_ARIA_STRINGS, key, ctx);
        } catch (defaultErr) {
            printDebug(() => [`default aria string formatter for "${key}" also threw`, defaultErr]);
            return "";
        }
    }
}

function refreshInstructions(): void {
    if (isOnServer) return;
    docToAlertsDiv.forEach((alertsDiv, doc) =>
        Object.entries(INSTRUCTION_ID_TO_STRING_KEY).forEach(([id, key]) => {
            const div = doc.getElementById(id);
            if (div) renderInstruction(div, formatWithFallback(key, instructionCtx));
        }),
    );
}

/**
 * Sets the context the static instruction formatters receive, and re-renders them. Internal - the
 * public entry point is configure({ keyboardDragTrigger }).
 */
export function setInstructionContext(ctx: InstructionContext): void {
    instructionCtx = { ...ctx };
    refreshInstructions();
}

/**
 * Formats and announces one configured ARIA message. If a consumer formatter throws, the built-in
 * English formatter is used and the error is reported through printDebug. Formatter errors must not
 * escape because this function runs during the drag lifecycle.
 * @param key - one of the keys accepted by configure({ ariaStrings })
 * @param ctx - the interpolation context for that key
 * @param doc - the document of the zone the message is about, defaults to the one that loaded this module
 */
export function announceToScreenReader(key: keyof AriaStrings, ctx?: object, doc?: Document): void {
    alertToScreenReader(formatWithFallback(key, ctx), doc);
}
