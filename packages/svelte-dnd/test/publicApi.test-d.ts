import { expectTypeOf } from "vitest";
import type { Attachment } from "svelte/attachments";
import {
    DRAGGED_ELEMENT_ID,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    SOURCES,
    TRIGGERS,
    alertToScreenReader,
    configure,
    dndzone,
    dragHandle,
    dragHandleZone,
} from "@lukez/svelte-dnd";
import type {
    AriaStrings,
    DndConfig,
    DndEvent,
    DndEventInfo,
    Item,
    Options,
    TransformDraggedElementFunction,
} from "@lukez/svelte-dnd";

// Review Focus 3: an interface has no index signature, so it does not assign to Record<string, unknown>
interface Row {
    id: number;
    name: string;
}
declare const rows: Row[];

// dndzone: the item type flows from `items` into the callbacks
expectTypeOf(
    dndzone(() => ({
        items: rows,
        onconsider: (e) => expectTypeOf(e.items).toEqualTypeOf<Row[]>(),
        onfinalize: (e) => expectTypeOf(e).toEqualTypeOf<DndEvent<Row>>(),
        transformDraggedElement: (_el, data) => expectTypeOf(data).toEqualTypeOf<Row | undefined>(),
    })),
).toEqualTypeOf<Attachment<HTMLElement>>();
// @ts-expect-error the options are passed as a getter
dndzone({ items: rows });
// @ts-expect-error items is required
dndzone(() => ({}));
// a custom id key, no `id`
dndzone(() => ({ items: [{ key: 1 }] }));

// dragHandleZone: the same shape
expectTypeOf(
    dragHandleZone(() => ({
        items: rows,
        onconsider: (e) => expectTypeOf(e.items).toEqualTypeOf<Row[]>(),
        onfinalize: (e) => expectTypeOf(e).toEqualTypeOf<DndEvent<Row>>(),
        transformDraggedElement: (_el, data) => expectTypeOf(data).toEqualTypeOf<Row | undefined>(),
    })),
).toEqualTypeOf<Attachment<HTMLElement>>();
// @ts-expect-error the options are passed as a getter
dragHandleZone({ items: rows });
// @ts-expect-error items is required
dragHandleZone(() => ({}));
dragHandleZone(() => ({ items: [{ key: 1 }] }));
expectTypeOf(dragHandle).toEqualTypeOf<Attachment<HTMLElement>>();

// types
expectTypeOf<Item>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf<Options<Row>["items"]>().toEqualTypeOf<Row[]>();
expectTypeOf<Options<Row>["onconsider"]>().toEqualTypeOf<((event: DndEvent<Row>) => void) | undefined>();
expectTypeOf<Options<Row>["onfinalize"]>().toEqualTypeOf<((event: DndEvent<Row>) => void) | undefined>();
expectTypeOf<Options<Row>["transformDraggedElement"]>().toEqualTypeOf<
    TransformDraggedElementFunction<Row> | undefined
>();
expectTypeOf<TransformDraggedElementFunction<Row>>().toEqualTypeOf<
    (element?: HTMLElement, draggedElementData?: Row, index?: number) => void
>();
expectTypeOf<TransformDraggedElementFunction>().toEqualTypeOf<
    (element?: HTMLElement, draggedElementData?: Item, index?: number) => void
>();
expectTypeOf<DndEvent>().toEqualTypeOf<{ items: Item[]; info: DndEventInfo }>();
expectTypeOf<DndEvent<Row>["items"]>().toEqualTypeOf<Row[]>();
// info.id is inferred from the item's id field, and unknown without one (a custom idKey) or for the default Item
expectTypeOf<DndEventInfo>().toEqualTypeOf<{ trigger: TRIGGERS; id: unknown; source: SOURCES }>();
expectTypeOf<DndEventInfo<Row>>().toEqualTypeOf<{ trigger: TRIGGERS; id: number; source: SOURCES }>();
expectTypeOf<DndEvent<Row>["info"]>().toEqualTypeOf<DndEventInfo<Row>>();
expectTypeOf<DndEvent<Row>["info"]["id"]>().toEqualTypeOf<number>();
expectTypeOf<DndEvent<{ key: number }>["info"]["id"]>().toEqualTypeOf<unknown>();
dndzone(() => ({
    items: rows,
    onfinalize: (e) => expectTypeOf(e.info.id).toEqualTypeOf<number>(),
}));
dndzone(() => ({
    items: [{ key: 1 }],
    onfinalize: (e) => expectTypeOf(e.info.id).toEqualTypeOf<unknown>(),
}));
// the useComputedStyleForRects option replaces the feature flag
expectTypeOf<Options["useComputedStyleForRects"]>().toEqualTypeOf<boolean | undefined>();

// the kept constants keep their literal types
expectTypeOf(TRIGGERS.DRAGGED_ENTERED).toEqualTypeOf<"draggedEntered">();
expectTypeOf(SOURCES.KEYBOARD).toEqualTypeOf<"keyboard">();
expectTypeOf(SOURCES.POINTER).toEqualTypeOf<"pointer">();
expectTypeOf<typeof SHADOW_ITEM_MARKER_PROPERTY_NAME>().toEqualTypeOf<"isDndShadowItem">();
expectTypeOf<typeof SHADOW_PLACEHOLDER_ITEM_ID>().toEqualTypeOf<"id:dnd-shadow-placeholder-0000">();
expectTypeOf<typeof DRAGGED_ELEMENT_ID>().toEqualTypeOf<"dnd-action-dragged-el">();
// a switch over every TRIGGERS key narrows `trigger` to never in the default branch
export function exhaustiveTriggerSwitch(info: DndEventInfo): void {
    switch (info.trigger) {
        case TRIGGERS.DRAG_STARTED:
        case TRIGGERS.DRAGGED_ENTERED:
        case TRIGGERS.DRAGGED_ENTERED_ANOTHER:
        case TRIGGERS.DRAGGED_OVER_INDEX:
        case TRIGGERS.DRAGGED_LEFT:
        case TRIGGERS.DRAGGED_LEFT_ALL:
        case TRIGGERS.DROPPED_INTO_ZONE:
        case TRIGGERS.DROPPED_INTO_ANOTHER:
        case TRIGGERS.DROPPED_OUTSIDE_OF_ANY:
        case TRIGGERS.DRAG_STOPPED:
            break;
        default:
            expectTypeOf(info.trigger).toBeNever();
    }
}

// configure
configure({ keyboardDragTrigger: null, ariaStrings: null, debug: true, idKey: "key" });
configure({ keyboardDragTrigger: "space" });
configure({ keyboardDragTrigger: "enter" });
configure({ keyboardDragTrigger: "space_or_enter" });
configure({ ariaStrings: { dropped: ({ itemLabel, position }) => `${itemLabel} ${position}` } });
// @ts-expect-error not a trigger
configure({ keyboardDragTrigger: "tab" });
// @ts-expect-error not a key of DndConfig
configure({ idkey: "x" });
expectTypeOf(configure).parameters.toEqualTypeOf<[config: DndConfig]>();
expectTypeOf(configure).returns.toBeVoid();
expectTypeOf<AriaStrings["dropped"]>().toEqualTypeOf<
    ((ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string) | undefined
>();
expectTypeOf<AriaStrings["zoneDragDisabledInstruction"]>().toEqualTypeOf<string | undefined>();
expectTypeOf(alertToScreenReader).parameters.toEqualTypeOf<[txt: string, doc?: Document]>();

// removed exports
// @ts-expect-error replaced by the useComputedStyleForRects zone option
void import("@lukez/svelte-dnd").then((m) => m.setFeatureFlag);
// @ts-expect-error replaced by the useComputedStyleForRects zone option
void import("@lukez/svelte-dnd").then((m) => m.FEATURE_FLAG_NAMES);
// @ts-expect-error replaced by configure({ ariaStrings })
void import("@lukez/svelte-dnd").then((m) => m.setAriaStrings);
// @ts-expect-error replaced by configure({ keyboardDragTrigger })
void import("@lukez/svelte-dnd").then((m) => m.setKeyboardDragTrigger);
// @ts-expect-error replaced by configure({ debug })
void import("@lukez/svelte-dnd").then((m) => m.setDebugMode);
// @ts-expect-error replaced by configure({ idKey })
void import("@lukez/svelte-dnd").then((m) => m.overrideItemIdKeyNameBeforeInitialisingDndZones);
// @ts-expect-error internal, dndzone wraps it
void import("@lukez/svelte-dnd").then((m) => m.createZone);
// @ts-expect-error there are no event attributes left
export type RemovedDndZoneAttributes = import("@lukez/svelte-dnd").DndZoneAttributes<Row>;
