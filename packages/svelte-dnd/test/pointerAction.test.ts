import { dndzone } from "../src/pointerAction";
import { DRAGGED_ELEMENT_ID, TRIGGERS } from "../src/constants";
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
    });
});
