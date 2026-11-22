import { expectTypeOf } from "vitest";
import type { ActionReturn } from "svelte/action";
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
    DndZoneAttributes,
    Item,
    Options,
    TransformDraggedElementFunction,
} from "@lukez/svelte-dnd";

type Row = { id: number; name: string };

expectTypeOf(dndzone<Row>).returns.toEqualTypeOf<Attachment<HTMLElement>>();
expectTypeOf(dragHandleZone<Row>).returns.toEqualTypeOf<ActionReturn<Options<Row>, DndZoneAttributes<Row>>>();
// @ts-expect-error items is required
dndzone(() => ({}));
// Review Focus 2: a custom id key, no `id`
dndzone(() => ({ items: [{ key: 1 }] }));
expectTypeOf(dragHandle).returns.toEqualTypeOf<{ update: () => void; destroy: () => void }>();

expectTypeOf<Item>().toEqualTypeOf<Record<string, any>>();
expectTypeOf<Options["transformDraggedElement"]>().toEqualTypeOf<TransformDraggedElementFunction | undefined>();
expectTypeOf<TransformDraggedElementFunction>().toEqualTypeOf<
    (element?: HTMLElement, draggedElementData?: Item, index?: number) => void
>();
expectTypeOf<DndEvent<Row>["items"]>().toEqualTypeOf<Row[]>();
expectTypeOf<DndEventInfo>().toEqualTypeOf<{ trigger: TRIGGERS; id: string; source: SOURCES }>();
// Review Focus 1
expectTypeOf(TRIGGERS.DRAGGED_ENTERED).toEqualTypeOf<"draggedEntered">();
expectTypeOf(SOURCES.KEYBOARD).toEqualTypeOf<"keyboard">();
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
// Review Focus 5
expectTypeOf<Parameters<NonNullable<DndZoneAttributes<Row>["onconsider"]>>[0]>().toEqualTypeOf<
    CustomEvent<DndEvent<Row>>
>();
expectTypeOf<Parameters<NonNullable<DndZoneAttributes<Row>["on:finalize"]>>[0]>().toEqualTypeOf<
    CustomEvent<DndEvent<Row>>
>();

expectTypeOf<typeof SHADOW_ITEM_MARKER_PROPERTY_NAME>().toEqualTypeOf<"isDndShadowItem">();
expectTypeOf<typeof SHADOW_PLACEHOLDER_ITEM_ID>().toEqualTypeOf<"id:dnd-shadow-placeholder-0000">();
expectTypeOf<typeof DRAGGED_ELEMENT_ID>().toEqualTypeOf<"dnd-action-dragged-el">();

configure({ keyboardDragTrigger: "space" });
configure({ keyboardDragTrigger: "enter" });
configure({ keyboardDragTrigger: "space_or_enter" });
configure({ keyboardDragTrigger: null });
// @ts-expect-error not a trigger
configure({ keyboardDragTrigger: "tab" });

configure({ ariaStrings: null });
configure({ ariaStrings: { dropped: ({ itemLabel, position }) => `${itemLabel} ${position}` } });
configure({ idKey: "key", debug: true });
// @ts-expect-error not a key of DndConfig
configure({ idkey: "key" });
expectTypeOf(configure).parameters.toEqualTypeOf<[config: DndConfig]>();
expectTypeOf(configure).returns.toBeVoid();
expectTypeOf<AriaStrings["dropped"]>().toEqualTypeOf<
    ((ctx: { itemLabel: string; zoneLabel: string; position: number; count: number }) => string) | undefined
>();
expectTypeOf<AriaStrings["zoneDragDisabledInstruction"]>().toEqualTypeOf<string | undefined>();
expectTypeOf(alertToScreenReader).parameters.toEqualTypeOf<[txt: string, doc?: Document]>();

// the useComputedStyleForRects option replaces the feature flag
expectTypeOf<Options["useComputedStyleForRects"]>().toEqualTypeOf<boolean | undefined>();
