import type { TRIGGERS, SOURCES } from "./constants";

/**
 * The engine's internal shape of an item. Public generics take `T extends object` instead, since an interface without an
 * index signature does not assign to this type. The id key is checked at runtime.
 */
export type Item = Record<string, unknown>;

export interface Options<T extends object = Item> {
    /** the list of items that was used to generate the children of the given node (the list used in the #each block) */
    items: T[];
    /** the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, defaults to a base type */
    type?: string;
    /** if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict, defaults to zero */
    flipDurationMs?: number;
    dragDisabled?: boolean;
    /** whether dragged element should morph to zone dimensions */
    morphDisabled?: boolean;
    dropFromOthersDisabled?: boolean;
    /** set the tabindex of the list container when not dragging */
    zoneTabIndex?: number;
    /** set the tabindex of the list container items when not dragging */
    zoneItemTabIndex?: number;
    dropTargetClasses?: string[];
    dropTargetStyle?: Record<string, string>;
    transformDraggedElement?: TransformDraggedElementFunction<T>;
    autoAriaDisabled?: boolean;
    centreDraggedOnCursor?: boolean;
    /** cancels the drop animation to place */
    dropAnimationDisabled?: boolean;
    /**
     * Improve touch UX: true => default 80 ms delay, number => custom delay in ms.
     * false/undefined => drag starts instantly (legacy behaviour)
     * On touch devices, wait this long before converting the gesture to a drag.
     */
    delayTouchStart?: boolean | number;
    /**
     * Use cursor position instead of dragged element center for drop zone detection
     */
    useCursorForDetection?: boolean;
    /**
     * Default false. Copies the computed width and height to the dragged clone, and does not set them from the shadow
     * element's bounding rect while morphing. A workaround for issue 454 (a browser bug): these rect values take time to
     * update in a grid layout. Setting it can cause strange behaviour in non-grid zones, see issue 470.
     */
    useComputedStyleForRects?: boolean;
    /** called while the user drags, with the items the zone should render now */
    onconsider?: (event: DndEvent<T>) => void;
    /** called when the drag ends, with the items the zone should keep */
    onfinalize?: (event: DndEvent<T>) => void;
}

/** The global settings, see `configure` */
export interface DndConfig {
    /** item id key, default "id". Throws if any zone is mounted. */
    idKey?: string;
    /** default "space_or_enter". null restores the default. */
    keyboardDragTrigger?: "space" | "enter" | "space_or_enter" | null;
    /** full locale over the English defaults. null restores English. */
    ariaStrings?: AriaStrings | null;
    /** console.debug output */
    debug?: boolean;
}

/**
 * The type of an item's `id` field, without `undefined` even when the field is optional, since the id is required at
 * runtime. `unknown` when the item type has no `id` field, as with a custom idKey set through `configure`, and for the
 * default Item, whose index signature promises no `id` field.
 */
type ItemId<T> = T extends { id?: infer I } ? Exclude<I, undefined> : unknown;

export interface DndEventInfo<T = Item> {
    /** the type of dnd event that took place */
    trigger: TRIGGERS;
    /**
     * the id of the dragged item: the value of its id key. Inferred from the item's `id` field, without `undefined`
     * when that field is optional, since the id is required at runtime. `unknown` when the item type has no `id`
     * field, as with a custom idKey, and for the default Item
     */
    id: ItemId<T>;
    /** the type of interaction that the user used to perform the dnd operation */
    source: SOURCES;
}

export type DndEvent<T = Item> = {
    items: T[];
    info: DndEventInfo<T>;
};

/**
 * @param element - the dragged element.
 * @param draggedElementData - the data of the item from the items array
 * @param index - the index the dragged element would get if dropped into the new dnd-zone
 */
export type TransformDraggedElementFunction<T = Item> = (
    element?: HTMLElement,
    draggedElementData?: T,
    index?: number,
) => void;

/**
 * Every message key receives the same core context - itemLabel, zoneLabel, position, count -
 * so a consumer can word any of them positionally. Only dragStarted carries an extra.
 */
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
