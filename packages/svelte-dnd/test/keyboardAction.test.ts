import { dndzone } from "../src/keyboardAction";
import { TRIGGERS } from "../src/constants";
import { configure } from "../src/configure";
import type { DndEvent, Item, Options } from "../src/types";
import { recordCalls } from "./helpers/callbacks";

describe("keyboardAction", () => {
    const actions: { destroy(): void }[] = [];
    const zones: HTMLElement[] = [];

    function createZone(items: Item[], options: Partial<Options> = {}) {
        const zone = document.createElement("div");
        items.forEach(() => zone.appendChild(document.createElement("div")));
        document.body.appendChild(zone);
        zones.push(zone);
        const zoneAction = dndzone(zone, { items, ...options });
        // a consumer passes its callbacks on every update, as the options getter of the attachment does
        const { onconsider, onfinalize } = options;
        const action = {
            update: (newOptions: Options) => zoneAction.update({ onconsider, onfinalize, ...newOptions }),
            destroy: () => zoneAction.destroy(),
        };
        actions.push(action);
        return { zone, action, children: Array.from(zone.children) as HTMLElement[] };
    }

    afterEach(() => {
        actions
            .splice(0)
            .reverse()
            .forEach((action) => action.destroy());
        zones.splice(0).forEach((zone) => zone.remove());
    });

    it("can synchronously destroy the focused zone from the drag-stopped handler", () => {
        let dragStoppedEvents = 0;
        const {
            action,
            children: [item],
        } = createZone([{ id: 1 }], {
            onconsider: (e) => {
                if (e.info.trigger === TRIGGERS.DRAG_STOPPED) {
                    dragStoppedEvents++;
                    action.destroy();
                }
            },
        });

        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));

        expect(dragStoppedEvents).to.equal(1);
    });

    it("does not call a keyboard zone destroyed from its own drag-stopped callback twice", () => {
        const recorded = recordCalls();
        let destroyedAfter: number | undefined;
        const {
            action,
            children: [item],
        } = createZone([{ id: 1 }], {
            onconsider: (e) => {
                recorded.onconsider(e);
                if (e.info.trigger === TRIGGERS.DRAG_STOPPED) {
                    action.destroy();
                    destroyedAfter = recorded.calls.length;
                }
            },
            onfinalize: recorded.onfinalize,
        });

        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

        expect(destroyedAfter, "the drag-stopped callback should have destroyed the zone").not.to.equal(undefined);
        expect(recorded.calls.length, "the destroyed zone gets no calls").to.equal(destroyedAfter);
        expect(recorded.calls.map(({ kind, detail }) => [kind, detail.info.trigger])).to.deep.equal([
            ["consider", TRIGGERS.DRAG_STARTED],
            ["consider", TRIGGERS.DRAG_STOPPED],
        ]);
    });

    it("does not call a keyboard zone for the drop that destroying it mid-drag causes", () => {
        const recorded = recordCalls();
        const {
            action,
            children: [item],
        } = createZone([{ id: 1 }], { onconsider: recorded.onconsider, onfinalize: recorded.onfinalize });
        const { zone: otherZone } = createZone([{ id: 2 }]);

        item.focus();
        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        const callsBeforeDestroy = recorded.calls.length;
        action.destroy();

        expect(recorded.calls.length, "the destroyed zone gets no calls").to.equal(callsBeforeDestroy);
        expect(otherZone.style.outline, "the drag should have ended").to.equal("");
    });

    it("restores the other zones when the drag-stopped handler destroys the focused zone", () => {
        const {
            action,
            children: [item],
        } = createZone([{ id: 1 }], {
            onconsider: (e) => {
                if (e.info.trigger === TRIGGERS.DRAG_STOPPED) action.destroy();
            },
        });
        const { zone: otherZone } = createZone([{ id: 2 }]);

        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        expect(otherZone.style.outline, "should style the other zone during the drag").not.to.equal("");
        item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));

        expect(otherZone.style.outline).to.equal("");
        expect(otherZone.tabIndex).to.equal(0);
        expect((otherZone.children[0] as HTMLElement).tabIndex).to.equal(0);
    });

    ["source first", "destination first"].forEach((updateOrder) => {
        it(`follows the grabbed item when a consumer moves it to another zone (${updateOrder})`, () => {
            const dragStoppedOn: HTMLElement[] = [];
            const recordDragStopped = (zone: () => HTMLElement) => (e: DndEvent) => {
                if (e.info.trigger === TRIGGERS.DRAG_STOPPED) dragStoppedOn.push(zone());
            };
            const {
                zone: zoneA,
                action: actionA,
                children: [itemA],
            } = createZone([{ id: "a" }, { id: "b" }], { onconsider: recordDragStopped(() => zoneA) });
            const { zone: zoneB, action: actionB } = createZone([], { onconsider: recordDragStopped(() => zoneB) });

            itemA.focus();
            itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));

            zoneA.removeChild(itemA);
            const movedItem = updateOrder === "source first" ? itemA : document.createElement("div");
            zoneB.appendChild(movedItem);
            if (updateOrder === "source first") {
                actionA.update({ items: [{ id: "b" }] });
                actionB.update({ items: [{ id: "a" }] });
            } else {
                actionB.update({ items: [{ id: "a" }] });
                actionA.update({ items: [{ id: "b" }] });
            }

            expect(document.activeElement, "should keep the moved item focused").to.equal(movedItem);
            expect(zoneA.tabIndex, "should make the previous zone reachable again").to.equal(0);
            expect(zoneB.tabIndex, "should remove the current zone from the tab order").to.equal(-1);

            movedItem.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
            expect(dragStoppedOn, "should stop the drag in the zone that now holds the item").to.deep.equal([zoneB]);
        });
    });

    it("keeps a same-type nested zone untabbable when the moved item is recreated", () => {
        const {
            zone: zoneA,
            action: actionA,
            children: [itemA],
        } = createZone([{ id: "a" }, { id: "b" }]);
        const { zone: zoneB, action: actionB } = createZone([]);

        itemA.focus();
        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));

        zoneA.removeChild(itemA);
        actionA.update({ items: [{ id: "b" }] });

        const replacementItem = document.createElement("div");
        const nestedZone = document.createElement("div");
        nestedZone.appendChild(document.createElement("div"));
        replacementItem.appendChild(nestedZone);
        zoneB.appendChild(replacementItem);

        // Svelte configures a nested action before the action on its parent.
        const nestedAction = dndzone(nestedZone, { items: [{ id: "nested" }] });
        actions.push(nestedAction);
        expect(nestedZone.tabIndex, "should initially reflect the old focused item").to.equal(0);

        actionB.update({ items: [{ id: "a" }] });

        expect(document.activeElement, "should focus the replacement item").to.equal(replacementItem);
        expect(zoneA.tabIndex, "should make the old zone reachable").to.equal(0);
        expect(zoneB.tabIndex, "should remove the new current zone from the tab order").to.equal(-1);
        expect(nestedZone.tabIndex, "should keep a nested zone inside the dragged item unreachable").to.equal(-1);
    });

    it("does not let another zone type with the same item id steal the grab", () => {
        const dragStoppedOn: HTMLElement[] = [];
        const recordDragStopped = (zone: () => HTMLElement) => (e: DndEvent) => {
            if (e.info.trigger === TRIGGERS.DRAG_STOPPED) dragStoppedOn.push(zone());
        };
        const {
            zone: zoneA,
            children: [itemA],
        } = createZone([{ id: "same" }], { type: "type-a", onconsider: recordDragStopped(() => zoneA) });
        const {
            zone: zoneB,
            action: actionB,
            children: [itemB],
        } = createZone([{ id: "same" }], { type: "type-b", onconsider: recordDragStopped(() => zoneB) });

        itemA.focus();
        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        actionB.update({ items: [{ id: "same" }], type: "type-b" });

        expect(document.activeElement, "should keep focus on the grabbed item").to.equal(itemA);
        expect(itemB.tabIndex, "should not make the unrelated item active").to.equal(-1);

        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        expect(dragStoppedOn, "should stop the drag in its original zone").to.deep.equal([zoneA]);
    });

    it("stops the drag before a click on another item grabs that item", () => {
        const calls: [string, TRIGGERS, unknown][] = [];
        const record = (zone: string) => (e: DndEvent) => calls.push([zone, e.info.trigger, e.info.id]);
        const {
            children: [itemA],
        } = createZone([{ id: "a" }, { id: "b" }], { onconsider: record("one") });
        const {
            children: [itemC],
        } = createZone([{ id: "c" }], { onconsider: record("two") });

        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        itemC.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(calls).to.deep.equal([
            ["one", TRIGGERS.DRAG_STARTED, "a"],
            ["one", TRIGGERS.DRAG_STOPPED, "a"],
            ["two", TRIGGERS.DRAG_STARTED, "c"],
        ]);
    });

    it("does not grab the clicked item when the drag-stopped handler disables dragging", () => {
        const triggers: TRIGGERS[] = [];
        const {
            action,
            children: [itemA, itemB],
        } = createZone([{ id: "a" }, { id: "b" }], {
            onconsider: (e) => {
                triggers.push(e.info.trigger);
                if (e.info.trigger === TRIGGERS.DRAG_STOPPED) {
                    action.update({ items: [{ id: "a" }, { id: "b" }], dragDisabled: true });
                }
            },
        });

        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        itemB.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
    });

    it("ends the grab when a consumer removes the grabbed item from every zone", () => {
        const triggers: TRIGGERS[] = [];
        const {
            zone: zoneA,
            action: actionA,
            children: [itemA, itemB],
        } = createZone([{ id: "a" }, { id: "b" }], {
            zoneTabIndex: 3,
            onconsider: (e) => triggers.push(e.info.trigger),
        });
        const { zone: zoneB } = createZone([]);

        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        zoneA.removeChild(itemA);
        actionA.update({ items: [{ id: "b" }], zoneTabIndex: 3 });

        zoneB.dispatchEvent(new FocusEvent("focus"));

        expect(triggers.filter((trigger) => trigger === TRIGGERS.DRAG_STOPPED)).to.have.length(1);
        expect(zoneA.tabIndex, "should restore the configured zone tab index").to.equal(3);
        expect(itemB.tabIndex, "should restore the item tab index").to.equal(0);
    });

    it("does not move another item when the grabbed item is missing", () => {
        const finalized: DndEvent[] = [];
        const onfinalize = (e: DndEvent) => finalized.push(e);
        const {
            zone: zoneA,
            action: actionA,
            children: [itemA],
        } = createZone([{ id: "a" }, { id: "b" }], { onfinalize });
        const { zone: zoneB } = createZone([], { onfinalize });

        itemA.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        zoneA.removeChild(itemA);
        actionA.update({ items: [{ id: "b" }] });

        zoneB.dispatchEvent(new FocusEvent("focus"));

        // oxlint-disable-next-line no-unused-expressions -- a Chai property assertion
        expect(finalized, "should not finalize a move for an unrelated item").to.be.empty;
    });

    describe("announcements", () => {
        afterEach(() => {
            configure({ ariaStrings: null });
        });

        function alertText() {
            // dndzone creates the aria alert div when a zone is created
            return document.getElementById("dnd-action-aria-alert")!.textContent;
        }

        function createLabelledZone(items: Item[], zoneLabel: string, options: Partial<Options> = {}) {
            const { zone, action, children } = createZone(items, options);
            zone.setAttribute("aria-label", zoneLabel);
            children.forEach((child, i) => child.setAttribute("aria-label", `Card ${i}`));
            return { zone, action, children };
        }

        function grab(item: HTMLElement) {
            item.focus();
            item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
        }

        it("names the zone when the drag starts", () => {
            const {
                children: [item],
            } = createLabelledZone([{ id: "a" }, { id: "b" }], "To do");

            grab(item);

            expect(alertText()).to.equal(
                "Started dragging item Card 0. Use the arrow keys to move it within its list To do",
            );
        });

        it("names the zone when arrowing within the list", () => {
            const {
                children: [item],
            } = createLabelledZone([{ id: "a" }, { id: "b" }], "To do");

            grab(item);
            item.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));

            expect(alertText()).to.equal("Moved item Card 0 to position 2 in the list To do");
        });

        it("routes every announcement through the overridable strings", () => {
            const seen: (string | null)[] = [];
            configure({
                ariaStrings: {
                    dragStarted: (ctx) => `grab:${ctx.itemLabel}:${ctx.zoneLabel}:${ctx.canMoveBetweenZones}`,
                    movedToPosition: (ctx) => `move:${ctx.itemLabel}:${ctx.zoneLabel}:${ctx.position}:${ctx.count}`,
                    dropped: (ctx) => `drop:${ctx.itemLabel}`,
                },
            });
            const {
                children: [item],
            } = createLabelledZone([{ id: "a" }, { id: "b" }], "To do");

            grab(item);
            seen.push(alertText());
            item.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
            seen.push(alertText());
            item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
            seen.push(alertText());

            expect(seen).to.deep.equal(["grab:Card 0:To do:false", "move:Card 0:To do:2:2", "drop:Card 0"]);
        });

        it("gives the grab and the drop the item's seat and the zone's size", () => {
            const seen: (string | null)[] = [];
            configure({
                ariaStrings: {
                    dragStarted: (ctx) => `grab:${ctx.zoneLabel}:${ctx.position}:${ctx.count}`,
                    dropped: (ctx) => `drop:${ctx.zoneLabel}:${ctx.position}:${ctx.count}`,
                },
            });
            const {
                children: [, second],
            } = createLabelledZone([{ id: "a" }, { id: "b" }, { id: "c" }], "To do");

            grab(second);
            seen.push(alertText());
            second.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
            second.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
            seen.push(alertText());

            // Multiple items ensure that hardcoded positions and stale counts fail the assertion.
            expect(seen).to.deep.equal(["grab:To do:2:3", "drop:To do:3:3"]);
        });

        it("reports canMoveBetweenZones when another zone can accept the item", () => {
            configure({ ariaStrings: { dragStarted: (ctx) => `${ctx.canMoveBetweenZones}` } });
            const {
                children: [item],
            } = createLabelledZone([{ id: "a" }], "To do");
            createLabelledZone([], "Done");

            grab(item);

            expect(alertText()).to.equal("true");
        });

        it("uses the cross-zone strings when focus moves to another zone", () => {
            configure({
                ariaStrings: {
                    movedToZoneEnd: (ctx) => `end:${ctx.itemLabel}:${ctx.zoneLabel}:${ctx.position}:${ctx.count}`,
                    movedToZoneStart: (ctx) => `start:${ctx.itemLabel}:${ctx.zoneLabel}:${ctx.position}:${ctx.count}`,
                },
            });
            const { zone: zoneA, children: itemsA } = createLabelledZone([{ id: "a" }], "To do");
            const { zone: zoneB } = createLabelledZone([{ id: "b" }], "Done");
            // Give the zones distinct positions so both insertion branches are reachable.
            zoneA.style.height = "50px";
            zoneB.style.height = "50px";

            // zoneB renders below zoneA, so moving into it is a move to the beginning.
            grab(itemsA[0]);
            zoneB.dispatchEvent(new FocusEvent("focus"));
            expect(alertText()).to.equal("start:Card 0:Done:1:2");

            // and moving back up into zoneA - which sits above zoneB - is a move to the end.
            zoneA.dispatchEvent(new FocusEvent("focus"));
            expect(alertText()).to.equal("end:Card 0:To do:1:1");
        });

        it("stays silent when autoAriaDisabled is set, even with overrides installed", () => {
            configure({ ariaStrings: { dragStarted: () => "SHOULD NOT BE SPOKEN" } });
            const {
                children: [item],
            } = createLabelledZone([{ id: "a" }], "To do", { autoAriaDisabled: true });

            grab(item);

            // dndzone creates the aria alert div when a zone is created
            expect(document.getElementById("dnd-action-aria-alert")!.textContent).to.equal("");
        });

        it("does not get stuck dragging when a consumer formatter throws on drop, and announces the default instead", () => {
            configure({
                ariaStrings: {
                    dropped: () => {
                        throw new Error("boom");
                    },
                },
            });
            const triggers: TRIGGERS[] = [];
            const {
                zone,
                children: [item],
            } = createLabelledZone([{ id: "a" }, { id: "b" }], "To do", {
                onconsider: (e) => triggers.push(e.info.trigger),
            });

            grab(item);
            item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));

            expect(
                alertText(),
                "should fall back to the default text instead of staying silent or speaking undefined",
            ).to.equal("Stopped dragging item Card 0");
            expect(triggers, "the drop should still have dispatched the drag-stopped consider event").to.include(
                TRIGGERS.DRAG_STOPPED,
            );
            expect(zone.tabIndex, "the drop should have completed and restored the zone's tab index").to.equal(0);
            expect(item.tabIndex, "the drop should have completed and restored the item's tab index").to.equal(0);

            // Starting another drag verifies that the formatter error did not leave drag state active.
            configure({ ariaStrings: null });
            grab(item);
            expect(alertText(), "a fresh grab afterwards should start a new drag rather than drop again").to.equal(
                "Started dragging item Card 0. Use the arrow keys to move it within its list To do",
            );
        });

        it("does not throw when a consumer formatter throws while a zone is destroyed mid-drag", () => {
            configure({
                ariaStrings: {
                    dropped: () => {
                        throw new Error("boom");
                    },
                },
            });
            const {
                action,
                children: [item],
            } = createLabelledZone([{ id: "a" }], "To do");

            grab(item);

            // Destroying the focused zone calls handleDrop synchronously; formatter errors must not interrupt teardown.
            expect(() => action.destroy()).to.not.throw();
        });
    });
});
