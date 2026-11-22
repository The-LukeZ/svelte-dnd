import { dndzone } from "../src/pointerAction";
import { configure } from "../src/configure";
import { DRAGGED_ELEMENT_ID, SHADOW_ELEMENT_ATTRIBUTE_NAME, TRIGGERS } from "../src/constants";
import type { DndEvent, Options } from "../src/types";

// the frame callbacks are called without a timestamp
type FrameCallback = (...args: any[]) => void;

function createZone(options: Partial<Options> & { id?: string; label?: string } = {}) {
    const zone = document.createElement("div");
    zone.style.width = "100px";
    zone.style.height = "100px";
    const item = document.createElement("div");
    item.style.width = "50px";
    item.style.height = "50px";
    item.textContent = options.label || "item";
    zone.appendChild(item);
    document.body.appendChild(zone);
    const items = [{ id: options.id || 1 }];
    const actionOptions = { ...options, items };
    delete actionOptions.id;
    delete actionOptions.label;
    const action = dndzone(zone, actionOptions);
    return { action, actionOptions, item, items, zone };
}

function startMouseDrag(item: HTMLElement): void {
    item.dispatchEvent(
        new MouseEvent("mousedown", { button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true }),
    );
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }));
}

function createTouchEvent(type: string, x = 5, y = 5): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
    return event;
}

function stubTimeouts() {
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const pending = new Map();
    let nextId = 1;
    let now = 0;

    window.setTimeout = (callback, delay = 0) => {
        const id = nextId++;
        pending.set(id, { callback, dueAt: now + delay });
        return id;
    };
    window.clearTimeout = (id) => pending.delete(id);

    return {
        runAll: () => {
            let remainingIterations = 100;
            while (pending.size > 0 && remainingIterations-- > 0) {
                const [id, timer] = Array.from(pending).sort(
                    ([, timerA], [, timerB]) => timerA.dueAt - timerB.dueAt,
                )[0];
                pending.delete(id);
                now = timer.dueAt;
                timer.callback();
            }
            if (pending.size > 0) throw new Error("timer queue did not settle");
        },
        restore: () => {
            window.setTimeout = originalSetTimeout;
            window.clearTimeout = originalClearTimeout;
        },
    };
}

describe("pointerAction", () => {
    it("a throwing onconsider does not break the drag", () => {
        const reportError = vi.spyOn(window, "reportError").mockImplementation(() => {});
        const finalizes: DndEvent[] = [];
        let considerCalls = 0;
        let created: ReturnType<typeof createZone> | undefined;
        try {
            created = createZone({
                dropAnimationDisabled: true,
                onconsider: () => {
                    if (considerCalls++ === 0) throw new Error("boom");
                },
                onfinalize: (e) => finalizes.push(e),
            });
            startMouseDrag(created.item);
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );

            expect(finalizes.map((e) => e.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ZONE]);
            expect(reportError).toHaveBeenCalledOnce();
        } finally {
            reportError.mockRestore();
            // A drag that ended normally ignores this mouseup; one left behind ends here.
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );
            created?.action.destroy();
            created?.zone.remove();
        }
    });

    it("does not restart observation when the original element is removed while a drop is finalizing", () => {
        const timeouts = stubTimeouts();
        const animationFrameCallbacks: FrameCallback[] = [];
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
            animationFrameCallbacks.push(callback);
            return animationFrameCallbacks.length;
        };

        let created: ReturnType<typeof createZone> | undefined;
        try {
            created = createZone({ flipDurationMs: 100 });
            startMouseDrag(created.item);
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );

            created.item.remove();
            animationFrameCallbacks.shift()!();

            // The pending keepOriginalElementInDom frame must stop rather than re-append the item
            // and restart observation during the asynchronous drop-settle window.
            expect(created.item.parentElement).to.equal(null);

            timeouts.runAll();
        } finally {
            created?.action.destroy();
            created?.zone.remove();
            timeouts.restore();
            window.requestAnimationFrame = originalRequestAnimationFrame;
        }
    });

    it("unwatches the exact zones when their type changes during an active drag", () => {
        const timeouts = stubTimeouts();
        const animationFrameCallbacks: FrameCallback[] = [];
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
            animationFrameCallbacks.push(callback);
            return animationFrameCallbacks.length;
        };

        let created: ReturnType<typeof createZone> | undefined;
        try {
            created = createZone({ dropAnimationDisabled: true, type: "before" });
            startMouseDrag(created.item);
            created.item.remove();
            animationFrameCallbacks.shift()!();
            created.action.update({ ...created.actionOptions, type: "after" });
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );

            timeouts.runAll();
            expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
        } finally {
            created?.action.destroy();
            created?.zone.remove();
            timeouts.restore();
            window.requestAnimationFrame = originalRequestAnimationFrame;
        }
    });

    it("finishes an animated drop when zones change type during the settle window", () => {
        const timeouts = stubTimeouts();
        let created: ReturnType<typeof createZone> | undefined;
        try {
            created = createZone({ flipDurationMs: 100, type: "before" });
            startMouseDrag(created.item);
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );
            created.action.update({ ...created.actionOptions, type: "after" });

            timeouts.runAll();
            expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
        } finally {
            created?.action.destroy();
            created?.zone.remove();
            timeouts.restore();
        }
    });

    it("cancels a delayed touch gesture when its zone is destroyed", () => {
        const timeouts = stubTimeouts();
        try {
            const created = createZone({ delayTouchStart: 50 });
            created.item.dispatchEvent(createTouchEvent("touchstart"));
            created.action.destroy();
            created.zone.remove();

            timeouts.runAll();
            expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
        } finally {
            timeouts.restore();
            // Ends a drag the destroyed zone failed to cancel, so it does not block the next test.
            window.dispatchEvent(createTouchEvent("touchend"));
        }
    });

    it("allows only one pending touch gesture to become a drag", () => {
        const timeouts = stubTimeouts();
        const first = createZone({ delayTouchStart: 50, dropAnimationDisabled: true, id: "first", label: "first" });
        const second = createZone({
            delayTouchStart: 50,
            dropAnimationDisabled: true,
            id: "second",
            label: "second",
        });
        try {
            first.item.dispatchEvent(createTouchEvent("touchstart"));
            second.item.dispatchEvent(createTouchEvent("touchstart"));

            timeouts.runAll();
            const draggedElements = document.querySelectorAll(`#${DRAGGED_ELEMENT_ID}`);
            expect(draggedElements).to.have.length(1);
            expect(draggedElements[0].textContent).to.equal("first");
        } finally {
            window.dispatchEvent(createTouchEvent("touchend"));
            first.action.destroy();
            second.action.destroy();
            first.zone.remove();
            second.zone.remove();
            timeouts.restore();
        }
    });

    it("does not reattach a zone after its scheduled removal was completed during drop cleanup", () => {
        let originalRequestAnimationFrame: typeof window.requestAnimationFrame;

        const animationFrameCallbacks: FrameCallback[] = [];
        originalRequestAnimationFrame = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
            animationFrameCallbacks.push(callback);
            return animationFrameCallbacks.length;
        };

        let created: ReturnType<typeof createZone> | undefined;
        try {
            created = createZone({ dropAnimationDisabled: true });
            startMouseDrag(created.item);
            created.action.destroy();
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );

            animationFrameCallbacks.forEach((callback) => callback());
            expect(created.zone.parentElement).to.equal(null);
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame;
            // A drag that ended normally ignores this mouseup; one left behind ends here.
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );
            created?.zone.remove();
        }
    });

    describe("a zone created on the element during the drop animation", () => {
        function createTwoItemZone() {
            const zone = document.createElement("div");
            zone.style.width = "100px";
            zone.style.height = "100px";
            for (const label of ["one", "two"]) {
                const item = document.createElement("div");
                item.style.width = "50px";
                item.style.height = "50px";
                item.textContent = label;
                zone.appendChild(item);
            }
            document.body.appendChild(zone);
            return zone;
        }

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        // drags the first item of the zone below the second one and drops it, with the drop animation running
        function dropFirstItemBelowSecond(zone: HTMLElement): void {
            (zone.children[0] as HTMLElement).dispatchEvent(
                new MouseEvent("mousedown", { button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true }),
            );
            window.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
            );
            window.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 10, clientY: 90, bubbles: true, cancelable: true }),
            );
            window.dispatchEvent(
                new MouseEvent("mouseup", { clientX: 10, clientY: 90, bubbles: true, cancelable: true }),
            );
        }

        it("a zone created on the element during the drop animation gets no finalize of the old drag", async () => {
            const zone = createTwoItemZone();
            const finalizes: DndEvent[] = [];
            const oldZone = dndzone(zone, { items: [{ id: 1 }, { id: 2 }], flipDurationMs: 200 });
            let newZone: ReturnType<typeof dndzone> | undefined;
            const parent = zone.parentElement;
            try {
                dropFirstItemBelowSecond(zone);
                oldZone.destroy();
                newZone = dndzone(zone, {
                    items: [{ id: 2 }, { id: 1 }],
                    flipDurationMs: 200,
                    onfinalize: (e) => finalizes.push(e),
                });
                await wait(300);

                expect(finalizes).to.have.length(0);
                // the old zone's cleanup neither hides nor removes the element the new zone is on
                expect(zone.isConnected).to.equal(true);
                expect(zone.parentElement).to.equal(parent);
                expect(zone.style.display).not.to.equal("none");
            } finally {
                window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                oldZone.destroy();
                newZone?.destroy();
                zone.remove();
            }
        });

        it("the new zone works after the old drag's cleanup", async () => {
            const zone = createTwoItemZone();
            const considers: DndEvent[] = [];
            const finalizes: DndEvent[] = [];
            const oldZone = dndzone(zone, { items: [{ id: 1 }, { id: 2 }], flipDurationMs: 200 });
            let newZone: ReturnType<typeof dndzone> | undefined;
            try {
                dropFirstItemBelowSecond(zone);
                oldZone.destroy();
                newZone = dndzone(zone, {
                    items: [{ id: 2 }, { id: 1 }],
                    dropAnimationDisabled: true,
                    onconsider: (e) => considers.push(e),
                    onfinalize: (e) => finalizes.push(e),
                });
                await wait(300);

                (zone.children[0] as HTMLElement).dispatchEvent(
                    new MouseEvent("mousedown", { button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true }),
                );
                window.dispatchEvent(
                    new MouseEvent("mousemove", { clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
                );

                expect(considers.map((e) => e.info.trigger)).to.include(TRIGGERS.DRAG_STARTED);

                // the drop needs the zone's config too: the old zone's cleanup must not have unregistered it
                const errors: unknown[] = [];
                const collectError = (e: ErrorEvent) => {
                    e.preventDefault();
                    errors.push(e.error);
                };
                window.addEventListener("error", collectError);
                window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                window.removeEventListener("error", collectError);
                expect(errors).to.deep.equal([]);
                expect(finalizes.map((e) => e.info.trigger)).to.deep.equal([TRIGGERS.DROPPED_INTO_ZONE]);
            } finally {
                window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                oldZone.destroy();
                newZone?.destroy();
                zone.remove();
            }
        });

        // a zone of another type on the element must not leave the old zone's type registration behind
        for (const destroyReplacementEarly of [false, true]) {
            it(`the old zone's type is unregistered when the new zone has another type${
                destroyReplacementEarly ? " and is destroyed at once" : ""
            }`, async () => {
                const zone = createTwoItemZone();
                const wrapper = document.createElement("div");
                document.body.appendChild(wrapper);
                wrapper.appendChild(zone);
                const oldZone = dndzone(zone, { items: [{ id: 1 }, { id: 2 }], type: "A", flipDurationMs: 200 });
                let newZone: ReturnType<typeof dndzone> | undefined;
                let freshZone: ReturnType<typeof createZone> | undefined;
                const errors: unknown[] = [];
                const collectError = (e: ErrorEvent) => {
                    e.preventDefault();
                    errors.push(e.error);
                };
                window.addEventListener("error", collectError);
                try {
                    dropFirstItemBelowSecond(zone);
                    oldZone.destroy();
                    newZone = dndzone(zone, { items: [{ id: 2 }, { id: 1 }], type: "B", flipDurationMs: 200 });
                    if (destroyReplacementEarly) {
                        // a zone inside the dragged item is destroyed at once, so it is gone before the old zone's cleanup
                        wrapper.setAttribute("data-is-dnd-original-dragged-item", "");
                        newZone.destroy();
                        wrapper.removeAttribute("data-is-dnd-original-dragged-item");
                    }
                    await wait(300);
                    newZone.destroy();

                    // every zone is gone, so the id key can be configured
                    expect(() => configure({ idKey: "id" })).not.to.throw();

                    // a drag of the old type finds its zones
                    freshZone = createZone({ type: "A" });
                    startMouseDrag(freshZone.item);
                    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                    // the drop finishes on a timeout
                    await wait(50);
                    expect(errors).to.deep.equal([]);
                } finally {
                    window.removeEventListener("error", collectError);
                    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                    oldZone.destroy();
                    newZone?.destroy();
                    freshZone?.action.destroy();
                    freshZone?.zone.remove();
                    wrapper.remove();
                    try {
                        configure({ idKey: "id" });
                    } catch {
                        // a leaked zone registration is what the test reports
                    }
                }
            });
        }
    });

    // zones that render their items from the consider and finalize events, as a framework does
    describe("zones that render from events", () => {
        type Row = { id: number | string };

        const mouseEvent = (type: string, x: number, y: number) =>
            new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });

        function createRenderedZone(left: number, rows: Row[], options: Partial<Options> = {}, itemStyle = "") {
            const zone = document.createElement("div");
            zone.style.cssText = `position: fixed; top: 0; left: ${left}px; width: 200px; height: 200px;`;
            document.body.appendChild(zone);
            const elements = new Map<unknown, HTMLElement>();
            const events: DndEvent[] = [];
            let current: Options;
            function render(items: Row[]): void {
                zone.replaceChildren(
                    ...items.map((item) => {
                        let element = elements.get(item.id);
                        if (!element) {
                            element = document.createElement("div");
                            element.style.cssText = `width: 50px; height: 50px; ${itemStyle}`;
                            element.textContent = String(item.id);
                            elements.set(item.id, element);
                        }
                        return element;
                    }),
                );
            }
            render(rows);
            const handle = (event: DndEvent): void => {
                events.push(event);
                current = { ...current, items: event.items };
                render(event.items as Row[]);
                action.update(current);
            };
            current = { ...options, items: rows, dropAnimationDisabled: true, onconsider: handle, onfinalize: handle };
            const action = dndzone(zone, current);
            return {
                zone,
                events,
                elementOf: (id: unknown) => elements.get(id)!,
                destroy: () => {
                    action.destroy();
                    zone.remove();
                },
            };
        }

        function centreOf(element: HTMLElement): { x: number; y: number } {
            const rect = element.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }

        // the zone's item ids as text, with the shadow element as "SHADOW"
        const itemIds = (zone: HTMLElement) =>
            Array.from(zone.children, (child) =>
                child.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME) ? "SHADOW" : child.textContent,
            );

        const draggedElement = () => document.getElementById(DRAGGED_ELEMENT_ID)!;

        // Content-box items with padding: the computed width is 50px while the bounding rect is 70px, so the inline size
        // of the dragged element shows which of the two the engine used.
        const PADDED = "padding: 10px;";

        function dragStart(from: HTMLElement): void {
            const start = centreOf(from);
            from.dispatchEvent(mouseEvent("mousedown", start.x, start.y));
            window.dispatchEvent(mouseEvent("mousemove", start.x + 5, start.y + 5));
        }

        it("uses the origin zone's useComputedStyleForRects for the dragged clone", () => {
            const origin = createRenderedZone(0, [{ id: 1 }], { useComputedStyleForRects: true }, PADDED);
            const target = createRenderedZone(300, [{ id: 2 }], {}, PADDED);
            try {
                dragStart(origin.elementOf(1));

                // the origin item's bounding rect is 70px, its computed size 50px
                expect(draggedElement().style.width).to.equal("50px");
                expect(draggedElement().style.height).to.equal("50px");
            } finally {
                window.dispatchEvent(mouseEvent("mouseup", 0, 0));
                origin.destroy();
                target.destroy();
            }
        });

        it("uses the target zone's setting while morphing", async () => {
            const origin = createRenderedZone(0, [{ id: 1 }], {}, "");
            const target = createRenderedZone(300, [{ id: 2 }], { useComputedStyleForRects: true }, PADDED);
            try {
                dragStart(origin.elementOf(1));
                expect(draggedElement().style.width, "sized from the origin item's rect").to.equal("50px");

                const over = centreOf(target.elementOf(2));
                window.dispatchEvent(mouseEvent("mousemove", over.x, over.y));

                // the engine detects the drop target on animation frames
                await vi.waitFor(() =>
                    expect(
                        target.zone.querySelector(`[${SHADOW_ELEMENT_ATTRIBUTE_NAME}]`),
                        "the dragged item is over the target",
                    ).to.not.equal(null),
                );
                // the target's shadow element has a 70px rect and a computed width of 50px
                expect(draggedElement().style.width).to.equal("50px");
                expect(draggedElement().style.height).to.equal("50px");
            } finally {
                window.dispatchEvent(mouseEvent("mouseup", 0, 0));
                origin.destroy();
                target.destroy();
            }
        });

        it("drags items with string ids", async () => {
            const created = createRenderedZone(0, [{ id: "a" }, { id: "b" }]);
            try {
                dragStart(created.elementOf("a"));
                const below = centreOf(created.elementOf("b"));
                window.dispatchEvent(mouseEvent("mousemove", below.x, below.y + 20));
                await vi.waitFor(() => expect(itemIds(created.zone)).to.deep.equal(["b", "SHADOW"]));
                window.dispatchEvent(mouseEvent("mouseup", below.x, below.y + 20));

                const finalize = created.events[created.events.length - 1];
                expect(finalize.info.trigger).to.equal(TRIGGERS.DROPPED_INTO_ZONE);
                expect(finalize.info.id).to.equal("a");
                expect(finalize.items.map((item) => item.id)).to.deep.equal(["b", "a"]);
            } finally {
                window.dispatchEvent(mouseEvent("mouseup", 0, 0));
                created.destroy();
            }
        });

        it("drags a list mixing string and number ids", async () => {
            const created = createRenderedZone(0, [{ id: "a" }, { id: 2 }]);
            try {
                dragStart(created.elementOf(2));
                const above = centreOf(created.elementOf("a"));
                window.dispatchEvent(mouseEvent("mousemove", above.x, above.y - 20));
                await vi.waitFor(() => expect(itemIds(created.zone)).to.deep.equal(["SHADOW", "a"]));
                window.dispatchEvent(mouseEvent("mouseup", above.x, above.y - 20));

                const finalize = created.events[created.events.length - 1];
                expect(finalize.info.trigger).to.equal(TRIGGERS.DROPPED_INTO_ZONE);
                expect(finalize.info.id, "a number id stays a number").to.equal(2);
                expect(finalize.items.map((item) => item.id)).to.deep.equal([2, "a"]);
            } finally {
                window.dispatchEvent(mouseEvent("mouseup", 0, 0));
                created.destroy();
            }
        });
    });
});
