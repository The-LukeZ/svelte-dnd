import { createZone } from "../../src/action";
import type { TRIGGERS } from "../../src/constants";
import type { WindowWithGlobals } from "../../src/helpers/util";
import type { DndEvent, Options } from "../../src/types";
import { createListeners } from "./callbacks";

/** The items of a list made by createList */
export type NamedItem = { id: string; name: string };

// Helpers for zones that live in another document than the one that loaded the library: a same-origin
// iframe (its own Window and Document in the same tab) or a popup opened with window.open (its own tab).

export function createFrame({
    parent = document,
    style = {},
}: { parent?: Document; style?: Partial<CSSStyleDeclaration> } = {}): {
    frame: HTMLIFrameElement;
    win: WindowWithGlobals;
    doc: Document;
} {
    const frame = parent.createElement("iframe");
    Object.assign(frame.style, { display: "block", border: "0", width: "300px", height: "200px" }, style);
    parent.body.appendChild(frame);
    // the frame is attached to a document above, so it has a contentDocument and a contentWindow
    const doc = frame.contentDocument!;
    doc.write("<!DOCTYPE html><body style='margin:0'></body>");
    doc.close();
    return { frame, win: frame.contentWindow as WindowWithGlobals, doc };
}

/**
 * Opens a same-origin popup. A blocked popup fails the test: it never skips it.
 */
export function openPopup(): { win: WindowWithGlobals; doc: Document } {
    // a same-origin popup shares the globals of its own realm, which WindowWithGlobals describes
    const win = window.open("", "", "width=400,height=300") as WindowWithGlobals | null;
    if (!win) {
        throw new Error("window.open did not open a popup");
    }
    win.document.write("<!DOCTYPE html><body style='margin:0'></body>");
    win.document.close();
    return { win, doc: win.document };
}

/**
 * A list that renders one element per item and re-renders on every consider and finalize, as a keyed
 * framework list would: an element is reused while its item stays in the list and recreated otherwise.
 * A test adds its own consider and finalize listeners with addListener; they run after the re-render.
 */
export function createList(
    doc: Document,
    {
        label,
        names,
        style = {},
        ...options
    }: { label: string; names: string[]; style?: Partial<CSSStyleDeclaration> } & Partial<
        Omit<Options<NamedItem>, "items">
    >,
): {
    zone: HTMLDivElement;
    action: ReturnType<typeof createZone<NamedItem>>;
    doc: Document;
    win: WindowWithGlobals;
    triggers: TRIGGERS[];
    events: { type: "consider" | "finalize"; detail: DndEvent<NamedItem> }[];
    addListener: ReturnType<typeof createListeners>["add"];
    names: () => string[];
    element: (name: string) => HTMLElement;
} {
    const zone = doc.createElement("div");
    zone.setAttribute("aria-label", label);
    Object.assign(zone.style, { width: "100px", minHeight: "30px" }, style);
    doc.body.appendChild(zone);
    let items: NamedItem[] = names.map((name) => ({ id: name, name }));
    let elements = new Map<string, HTMLElement>();
    function render() {
        const nextElements = new Map<string, HTMLElement>();
        for (const item of items) {
            let el = elements.get(item.id);
            if (!el) {
                el = doc.createElement("div");
                el.textContent = item.name;
                el.setAttribute("aria-label", item.name);
                el.style.height = "30px";
            }
            nextElements.set(item.id, el);
        }
        elements = nextElements;
        zone.replaceChildren(...nextElements.values());
    }
    render();
    const triggers: TRIGGERS[] = [];
    const events: { type: "consider" | "finalize"; detail: DndEvent<NamedItem> }[] = [];
    const listeners = createListeners();
    const onChange =
        (type: "consider" | "finalize") =>
        (detail: DndEvent<NamedItem>): void => {
            triggers.push(detail.info.trigger);
            events.push({ type, detail });
            items = detail.items;
            render();
            action.update(getOptions());
            listeners.call(type, detail);
        };
    const getOptions = (): Options<NamedItem> => ({
        items,
        flipDurationMs: 0,
        onconsider: onChange("consider"),
        onfinalize: onChange("finalize"),
        ...options,
    });
    const action = createZone(zone, getOptions());
    return {
        zone,
        action,
        doc,
        win: doc.defaultView!,
        triggers,
        events,
        addListener: listeners.add,
        names: () => items.map((item) => item.name),
        // the tests only ask for names that are in the list
        element: (name) => elements.get(name)!,
    };
}

export function key(target: Element | WindowWithGlobals, k: string): void {
    // a Window has no ownerDocument, an element has
    const { ownerDocument } = target as Element;
    const { KeyboardEvent } = ownerDocument ? ownerDocument.defaultView! : (target as WindowWithGlobals);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

export function mouse(win: WindowWithGlobals, type: string, x: number, y: number = x): MouseEvent {
    return new win.MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
}

export function alertText(doc: Document): string | null {
    return doc.getElementById("dnd-action-aria-alert")?.textContent ?? null;
}

export function sleepIn(win: WindowWithGlobals, ms: number): Promise<void> {
    return new Promise<void>((resolve) => win.setTimeout(resolve, ms));
}

/**
 * Records the listeners of the given types that are currently attached to a window.
 */
export function trackListeners(
    win: WindowWithGlobals,
    types: string[],
): { active: () => string[]; restore: () => void } {
    const { addEventListener, removeEventListener } = win;
    const attached = new Map<string, Set<EventListenerOrEventListenerObject>>(types.map((type) => [type, new Set()]));
    win.addEventListener = function (
        this: WindowWithGlobals,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ) {
        attached.get(type)?.add(listener);
        return addEventListener.call(this, type, listener, options);
    };
    win.removeEventListener = function (
        this: WindowWithGlobals,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ) {
        attached.get(type)?.delete(listener);
        return removeEventListener.call(this, type, listener, options);
    };
    return {
        active: () => types.filter((type) => attached.get(type)!.size > 0),
        restore: () => {
            win.addEventListener = addEventListener;
            win.removeEventListener = removeEventListener;
        },
    };
}

/**
 * Fails a test on an error thrown by an event listener. The library runs in listeners, and an error thrown there reaches
 * the window's "error" event rather than the test, so without this a test could pass with a broken drag.
 */
export function failOnListenerErrors(): void {
    let errors: string[];
    const onError = (e: ErrorEvent): number => errors.push(e.message);
    beforeEach(() => {
        errors = [];
        window.addEventListener("error", onError);
    });
    afterEach(() => {
        window.removeEventListener("error", onError);
        expect(errors, "errors thrown by listeners").to.deep.equal([]);
    });
}
