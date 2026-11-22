import type { DndEvent } from "../../src/types";

/**
 * Collects the calls of a zone's onconsider and onfinalize, in call order, the way a consider and a finalize listener did.
 */
export function recordCalls(): {
    onconsider: (e: DndEvent) => void;
    onfinalize: (e: DndEvent) => void;
    calls: { kind: "consider" | "finalize"; detail: DndEvent }[];
} {
    const calls: { kind: "consider" | "finalize"; detail: DndEvent }[] = [];
    return {
        onconsider: (detail) => calls.push({ kind: "consider", detail }),
        onfinalize: (detail) => calls.push({ kind: "finalize", detail }),
        calls,
    };
}

type Kind = "consider" | "finalize";

/**
 * Listeners that a test adds to a zone after creating it, the way it added consider and finalize event listeners: they
 * run in the order they were added, after the callbacks the zone was created with, and a `once` listener runs once.
 */
export function createListeners(): {
    add: (kind: Kind, listener: (e: DndEvent) => void, options?: { once?: boolean }) => void;
    call: (kind: Kind, e: DndEvent) => void;
} {
    const listeners: { kind: Kind; listener: (e: DndEvent) => void; once: boolean }[] = [];
    return {
        add: (kind, listener, { once = false } = {}) => listeners.push({ kind, listener, once }),
        call: (kind, e) => {
            for (const entry of listeners.slice()) {
                if (entry.kind !== kind) continue;
                if (entry.once) listeners.splice(listeners.indexOf(entry), 1);
                entry.listener(e);
            }
        },
    };
}
