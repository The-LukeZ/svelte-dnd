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
