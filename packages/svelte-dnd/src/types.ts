import type { TRIGGERS, SOURCES } from "./constants";

// oxlint-disable-next-line typescript/no-explicit-any -- TODO: stage 4, decide whether Item becomes Record<string, unknown>
export type Item = Record<string, any>;

export interface DndEventInfo {
    trigger: TRIGGERS; // the type of dnd event that took place
    id: string;
    source: SOURCES; // the type of interaction that the user used to perform the dnd operation
}

export type DndEvent<T = Item> = {
    items: T[];
    info: DndEventInfo;
};

export type TransformDraggedElementFunction = (
    element?: HTMLElement, // the dragged element.
    draggedElementData?: Item, // the data of the item from the items array
    index?: number, // the index the dragged element would get if dropped into the new dnd-zone
) => void;

// Every message key receives the same core context - itemLabel, zoneLabel, position, count -
// so a consumer can word any of them positionally. Only dragStarted carries an extra.
export interface AriaStrings {
    dragStarted?: (ctx: {
        itemLabel: string;
        zoneLabel: string;
        position: number;
        count: number;
        canMoveBetweenZones: boolean;
    }) => string;
    movedToPosition?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    movedToZoneEnd?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    movedToZoneStart?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    dropped?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    zoneActiveInstruction?: string | ((ctx: { keyboardDragTrigger: "space" | "enter" | "space_or_enter" }) => string);
    zoneDragDisabledInstruction?: string;
}
