import type { TRIGGERS, SOURCES } from "./constants";

// oxlint-disable-next-line typescript/no-explicit-any -- TODO: stage 4, decide whether Item becomes Record<string, unknown>
export type Item = Record<string, any>;

export interface Options<T extends Item = Item> {
    items: T[]; // the list of items that was used to generate the children of the given node
    type?: string; // the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, defaults to a base type
    flipDurationMs?: number; // if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict
    dragDisabled?: boolean;
    morphDisabled?: boolean;
    dropFromOthersDisabled?: boolean;
    zoneTabIndex?: number; // set the tabindex of the list container when not dragging
    zoneItemTabIndex?: number; // set the tabindex of the list container items when not dragging
    dropTargetClasses?: string[];
    dropTargetStyle?: Record<string, string>;
    transformDraggedElement?: TransformDraggedElementFunction;
    autoAriaDisabled?: boolean;
    centreDraggedOnCursor?: boolean;
    dropAnimationDisabled?: boolean;
    /**
     * Improve touch UX: true => default 80 ms delay, number => custom delay in ms.
     * false/undefined => drag starts instantly (legacy behaviour)
     */
    delayTouchStart?: boolean | number;
    /**
     * Use cursor position instead of dragged element center for drop zone detection
     */
    useCursorForDetection?: boolean;
}

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
