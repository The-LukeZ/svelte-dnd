import type { TRIGGERS, SOURCES } from "./constants";

/**
 * The shape of an item when no item type is given: any object. Every item needs an id under the id key, `id` unless
 * `configure({ idKey })` changes it, which the zone checks at runtime. The public generics take `T extends object`
 * instead, since an interface without an index signature does not assign to this type.
 */
export type Item = Record<string, unknown>;

/** The options of a `dndzone` or a `dragHandleZone`, returned by the getter the zone is given. */
export interface Options<T extends object = Item> {
    /**
     * The list of items the zone renders, the one used in its `#each` block. Each item needs a unique id under the id
     * key. Required.
     */
    items: T[];
    /**
     * The type of the zone. Items dragged from it can only be dropped in zones of the same type. Zones without a type
     * share one base type.
     * @default "--any--"
     */
    type?: string;
    /**
     * The duration in milliseconds of the zone's flip animation, if it animates its items with flip (recommended), so
     * the drag and the animation do not conflict. It also sets the duration of the drop animation.
     * @default 0
     */
    flipDurationMs?: number;
    /**
     * Turns dragging off for this zone's items: with the pointer and with the keyboard. With `dragHandleZone`, it turns
     * off this zone's handles only.
     * @default false
     */
    dragDisabled?: boolean;
    /**
     * Whether the dragged element keeps its own shape instead of taking the size and styles of the placeholder item in
     * the zone it hovers over.
     * @default false
     */
    morphDisabled?: boolean;
    /**
     * Stops the zone from accepting items dragged from other zones. Its own items can still be dragged and dropped
     * within it.
     * @default false
     */
    dropFromOthersDisabled?: boolean;
    /**
     * The tabindex of the zone element when no keyboard drag is in progress.
     * @default 0
     */
    zoneTabIndex?: number;
    /**
     * The tabindex of the zone's items when no keyboard drag is in progress.
     * @default 0
     */
    zoneItemTabIndex?: number;
    /**
     * Classes added to the zone while a drag is in progress that can drop into it, and removed when the drag ends.
     * @default []
     */
    dropTargetClasses?: string[];
    /**
     * Inline styles set on the zone while a drag is in progress that can drop into it, and removed when the drag ends.
     * The keys are CSS property names.
     * @default { outline: "rgba(255, 255, 102, 0.7) solid 2px" }
     */
    dropTargetStyle?: Record<string, string>;
    /**
     * Called during a pointer drag each time the zone renders the dragged item's placeholder, to change the look of
     * the dragged element. It runs after the element morphs, so its changes win.
     * @default a function that does nothing
     */
    transformDraggedElement?: TransformDraggedElementFunction<T>;
    /**
     * Stops the zone from setting ARIA roles and the `aria-describedby` instructions on itself and its items, and from
     * announcing keyboard drags to screen readers. Set it when you provide your own.
     * @default false
     */
    autoAriaDisabled?: boolean;
    /**
     * Centres the dragged element on the cursor when a pointer drag starts, instead of keeping the offset at which the
     * item was grabbed.
     * @default false
     */
    centreDraggedOnCursor?: boolean;
    /**
     * Drops the item in place at the end of a pointer drag, without animating it to its new position.
     * @default false
     */
    dropAnimationDisabled?: boolean;
    /**
     * How long a touch has to be held before it starts a drag, so that a swipe still scrolls the page. `true` waits
     * 80 ms, a number waits that many milliseconds, and `false` starts the drag as soon as the touch moves.
     * @default false
     */
    delayTouchStart?: boolean | number;
    /**
     * Uses the cursor position instead of the centre of the dragged element to find the zone and the index the item
     * is over.
     * @default false
     */
    useCursorForDetection?: boolean;
    /**
     * Sizes the dragged clone from computed styles instead of bounding rects: it copies the computed width, height and
     * box-sizing from the item when the drag starts, and from the shadow element while morphing. A workaround for issue 454 (a browser bug): these rect values take time to update
     * in a grid layout. Setting it can cause strange behaviour in non-grid zones, see issue 470.
     * @default false
     */
    useComputedStyleForRects?: boolean;
    /** Called while the user drags, with the items the zone should render now. */
    onconsider?: (event: DndEvent<T>) => void;
    /**
     * Called with the items the zone should keep: at the end of a pointer drag, and each time a keyboard drag moves
     * the item. A keyboard drag ends with an `onconsider` call whose trigger is `TRIGGERS.DRAG_STOPPED`.
     */
    onfinalize?: (event: DndEvent<T>) => void;
}

/** The global settings, see `configure`. */
export interface DndConfig {
    /**
     * The key of each item's id. Throws if any zone is mounted.
     * @default "id"
     */
    idKey?: string;
    /**
     * The keys that start and stop a keyboard drag. `null` restores the default.
     * @default "space_or_enter"
     */
    keyboardDragTrigger?: "space" | "enter" | "space_or_enter" | null;
    /** A full locale that replaces the English screen reader strings: keys left out use English. `null` restores English. */
    ariaStrings?: AriaStrings | null;
    /**
     * Turns console.debug output on or off.
     * @default false
     */
    debug?: boolean;
}

/**
 * The type of an item's `id` field, without `undefined` even when the field is optional, since the id is required at
 * runtime. `unknown` when the item type has no `id` field, as with a custom idKey set through `configure`, and for the
 * default Item, whose index signature promises no `id` field.
 */
type ItemId<T> = T extends { id?: infer I } ? Exclude<I, undefined> : unknown;

/** What happened in a drag event: what triggered it, which item, and from which input. */
export interface DndEventInfo<T = Item> {
    /** The kind of drag event that took place, one of `TRIGGERS`. */
    trigger: TRIGGERS;
    /**
     * The id of the dragged item: the value of its id key. Inferred from the item's `id` field, without `undefined`
     * when that field is optional, since the id is required at runtime. `unknown` when the item type has no `id`
     * field, as with a custom idKey, and for the default Item.
     */
    id: ItemId<T>;
    /** The kind of input that performed the drag, one of `SOURCES`. */
    source: SOURCES;
}

/** The argument of `onconsider` and `onfinalize`. */
export type DndEvent<T = Item> = {
    /** The items the zone should render: assign them to the zone's list. */
    items: T[];
    /** What happened. */
    info: DndEventInfo<T>;
};

/**
 * The type of the `transformDraggedElement` option. During a pointer drag it receives the element that follows the
 * pointer, the dragged item's data and the index the item would get if it were dropped now.
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
 * The strings the library speaks to screen readers, set with `configure({ ariaStrings })`.
 * Every message key receives the same core context - itemLabel, zoneLabel, position, count -
 * so a consumer can word any of them positionally. Only dragStarted carries an extra.
 * The labels are the `aria-label` attributes of the item and the zone, or empty.
 */
export interface AriaStrings {
    /**
     * Announced when a keyboard drag starts. `canMoveBetweenZones` is true when another zone can take the item.
     * The English default tells the user to use the arrow keys, and to tab to another list when it can.
     */
    dragStarted?: (ctx: {
        itemLabel: string;
        zoneLabel: string;
        position: number;
        count: number;
        canMoveBetweenZones: boolean;
    }) => string;
    /** Announced when an arrow key moves the item within its zone. `position` counts from 1. */
    movedToPosition?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    /** Announced when the item moves into a zone above or to the left of its zone, which puts it at the end. */
    movedToZoneEnd?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    /** Announced when the item moves into a zone below or to the right of its zone, which puts it at the start. */
    movedToZoneStart?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    /** Announced when a keyboard drag ends, with the zone and the position the item ended in. */
    dropped?: (ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string;
    /**
     * The instruction that describes a zone that can be dragged from, linked with `aria-describedby`. A function
     * receives the active keyboard drag trigger, so a translation can name the right key.
     */
    zoneActiveInstruction?: string | ((ctx: { keyboardDragTrigger: "space" | "enter" | "space_or_enter" }) => string);
    /** The instruction that describes a zone with `dragDisabled`, linked with `aria-describedby`. */
    zoneDragDisabledInstruction?: string;
}
