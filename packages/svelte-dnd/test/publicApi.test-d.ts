import { expectTypeOf } from "vitest";
import type { ActionReturn } from "svelte/action";
import {
    DRAGGED_ELEMENT_ID,
    FEATURE_FLAG_NAMES,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    SOURCES,
    TRIGGERS,
    alertToScreenReader,
    dndzone,
    dragHandle,
    dragHandleZone,
    overrideItemIdKeyNameBeforeInitialisingDndZones,
    setAriaStrings,
    setDebugMode,
    setFeatureFlag,
    setKeyboardDragTrigger,
} from "@lukez/svelte-dnd";
import type { DndEvent, DndEventInfo, DndZoneAttributes, Options } from "@lukez/svelte-dnd";

declare const node: HTMLElement;

type Row = { id: number; name: string };

expectTypeOf(dndzone<Row>).returns.toEqualTypeOf<ActionReturn<Options<Row>, DndZoneAttributes<Row>>>();
expectTypeOf(dragHandleZone<Row>).returns.toEqualTypeOf<ActionReturn<Options<Row>, DndZoneAttributes<Row>>>();
// @ts-expect-error items is required
dndzone(node, {});
// Review Focus 2: a custom id key, no `id`
dndzone(node, { items: [{ key: 1 }] });
expectTypeOf(dragHandle).returns.toEqualTypeOf<{ update: () => void; destroy: () => void }>();

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

setKeyboardDragTrigger("space");
setKeyboardDragTrigger("enter");
setKeyboardDragTrigger("space_or_enter");
setKeyboardDragTrigger(null);
setKeyboardDragTrigger(undefined);
setKeyboardDragTrigger();
// @ts-expect-error not a trigger
setKeyboardDragTrigger("tab");

setAriaStrings(null);
setAriaStrings({ dropped: ({ itemLabel, position }) => `${itemLabel} ${position}` });
expectTypeOf(alertToScreenReader).parameters.toEqualTypeOf<[txt: string, doc?: Document]>();

// Review Focus 3
setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);
setFeatureFlag("USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT", false);
// @ts-expect-error not a flag
setFeatureFlag("BOGUS", true);
expectTypeOf(setFeatureFlag).returns.toBeVoid();

expectTypeOf(overrideItemIdKeyNameBeforeInitialisingDndZones).parameters.toEqualTypeOf<[newKeyName: string]>();
expectTypeOf(setDebugMode).parameters.toEqualTypeOf<[isDebug: boolean]>();
