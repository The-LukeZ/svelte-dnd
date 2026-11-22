import { DRAGGED_ELEMENT_ID, TRIGGERS } from "../src/constants";
import { createFrame, createList, failOnListenerErrors, mouse, sleepIn } from "./helpers/otherWindow";

failOnListenerErrors();

// A drag in another window runs on that window's timers and reads its computed styles, so it keeps going
// when the loading window is hidden and the browser throttles or stops that window's timers and frames.
describe("a drag in another window uses that window's timers and styles", () => {
    const cleanups: (() => void)[] = [];
    afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

    function createListInFrame(options?: Partial<Parameters<typeof createList>[1]>): ReturnType<typeof createFrame> & {
        list: ReturnType<typeof createList>;
    } {
        const frame = createFrame();
        const list = createList(frame.doc, { label: "list", names: ["a", "b", "c"], ...options });
        cleanups.push(() => {
            list.action.destroy();
            frame.frame.remove();
        });
        return { ...frame, list };
    }

    // Replaces some of the loading window's globals for the duration of run, which may be async.
    function withLoadingWindowGlobals(replacements: Record<string, unknown>, run: () => Promise<void>): Promise<void> {
        const originals: Record<string, unknown> = {};
        Object.keys(replacements).forEach((name) => {
            originals[name] = (window as any)[name];
            (window as any)[name] = replacements[name];
        });
        return Promise.resolve()
            .then(run)
            .finally(() => Object.assign(window, originals));
    }
    const pausedTimers = { setTimeout: () => 0, requestAnimationFrame: () => 0 };

    // Each test releases the pointer after restoring the loading window's globals, so a failure leaves no
    // drag behind for the next test. The finalize test comes last because it cannot do that.
    it(
        "keeps observing the dragged element while the loading window's timers never fire",
        { timeout: 10000 },
        async () => {
            let observed;
            const { win, list } = createListInFrame({ flipDurationMs: 100 });
            await withLoadingWindowGlobals(pausedTimers, async () => {
                list.element("a").dispatchEvent(mouse(win, "mousedown", 50, 15));
                win.dispatchEvent(mouse(win, "mousemove", 50, 20));
                await sleepIn(win, 200);
                win.dispatchEvent(mouse(win, "mousemove", 50, 50));
                await sleepIn(win, 300);
                win.dispatchEvent(mouse(win, "mousemove", 50, 80));
                await sleepIn(win, 300);
                observed = {
                    overIndex: list.triggers.filter((trigger) => trigger === TRIGGERS.DRAGGED_OVER_INDEX).length,
                    names: list.names(),
                };
            }).finally(() => {
                win.dispatchEvent(mouse(win, "mouseup", 50, 80));
                return sleepIn(win, 300);
            });
            expect(observed).to.deep.equal({ overIndex: 2, names: ["b", "c", "a"] });
        },
    );

    it("styles the dragged element on its window's timers", { timeout: 10000 }, async () => {
        let observed;
        const { win, doc, list } = createListInFrame({
            morphDisabled: true,
            centreDraggedOnCursor: true,
            dropAnimationDisabled: true,
        });
        await withLoadingWindowGlobals(pausedTimers, async () => {
            list.element("a").dispatchEvent(mouse(win, "mousedown", 50, 15));
            win.dispatchEvent(mouse(win, "mousemove", 50, 20));
            await sleepIn(win, 100);
            // the drag has started, so the dragged element is in the frame
            const draggedEl = doc.getElementById(DRAGGED_ELEMENT_ID)!;
            // centred on the cursor, which is 5px below the item's centre
            observed = { top: draggedEl.style.top, sizeTransition: draggedEl.style.transition.includes("width") };
        }).finally(() => win.dispatchEvent(mouse(win, "mouseup", 50, 20)));
        expect(observed).to.deep.equal({ top: "5px", sizeTransition: true });
    });

    it(
        "starts a touch drag after the hold delay while the loading window's timers never fire",
        { timeout: 10000 },
        async () => {
            // assigned in the callback below, which is awaited before the read
            let observed!: TRIGGERS[];
            const { win, list } = createListInFrame({ delayTouchStart: 50, dropAnimationDisabled: true });
            const touch = (type: string, touches: { clientX: number; clientY: number }[]): Event => {
                const event = new win.Event(type, { bubbles: true, cancelable: true });
                Object.defineProperty(event, "touches", { value: touches });
                return event;
            };
            await withLoadingWindowGlobals(pausedTimers, async () => {
                list.element("a").dispatchEvent(touch("touchstart", [{ clientX: 50, clientY: 15 }]));
                await sleepIn(win, 150);
                observed = [...list.triggers];
            }).finally(() => win.dispatchEvent(touch("touchend", [])));
            expect(observed[0]).to.equal(TRIGGERS.DRAG_STARTED);
        },
    );

    it("dispatches consider and finalize events from the zone's window", () => {
        const { win, list } = createListInFrame({ dropAnimationDisabled: true });
        list.element("a").dispatchEvent(mouse(win, "mousedown", 50, 15));
        win.dispatchEvent(mouse(win, "mousemove", 50, 20));
        win.dispatchEvent(mouse(win, "mouseup", 50, 20));
        expect(list.events.map((e) => e.type)).to.deep.equal(["consider", "finalize"]);
        list.events.forEach((e) => expect(e).to.be.an.instanceof(win.CustomEvent));
    });

    it("reads computed styles through the window of the element", { timeout: 10000 }, async () => {
        let triggers;
        // A scroll container makes the library walk scroll parents, and morphing copies computed styles.
        const { win, list } = createListInFrame({
            style: { overflow: "auto", height: "120px" },
            dropAnimationDisabled: true,
        });
        const throwing = () => {
            throw new Error("read a computed style through the loading window");
        };
        await withLoadingWindowGlobals({ getComputedStyle: throwing }, async () => {
            list.element("a").dispatchEvent(mouse(win, "mousedown", 50, 15));
            win.dispatchEvent(mouse(win, "mousemove", 50, 20));
            await sleepIn(win, 100);
            win.dispatchEvent(mouse(win, "mousemove", 50, 50));
            await sleepIn(win, 100);
            triggers = [...list.triggers];
        }).finally(() => win.dispatchEvent(mouse(win, "mouseup", 50, 50)));
        expect(triggers).to.include(TRIGGERS.DRAGGED_OVER_INDEX);
    });

    // A long observation interval leaves the scrolling to the scroller's own animation frames between two samples.
    const LONG_OBSERVATION = { flipDurationMs: 1000, dropAnimationDisabled: true };
    // Long enough that the fastest auto-scroll (Firefox's) has not reached the end when the item is dropped.
    const manyNames = Array.from({ length: 100 }, (_, i) => `item ${i}`);

    it("auto-scrolls a list near its edge on the iframe's animation frames", { timeout: 10000 }, async () => {
        let observed;
        const { win, list } = createListInFrame({
            names: manyNames,
            style: { overflow: "auto", height: "90px" },
            ...LONG_OBSERVATION,
        });
        await withLoadingWindowGlobals(pausedTimers, async () => {
            list.element("item 0").dispatchEvent(mouse(win, "mousedown", 50, 15));
            win.dispatchEvent(mouse(win, "mousemove", 50, 80));
            await sleepIn(win, 100);
            const first = list.zone.scrollTop;
            await sleepIn(win, 300);
            const second = list.zone.scrollTop;
            win.dispatchEvent(mouse(win, "mouseup", 50, 80));
            await sleepIn(win, 50);
            const atDrop = list.zone.scrollTop;
            await sleepIn(win, 200);
            observed = {
                kept: second > first,
                stoppedAfterDrop: list.zone.scrollTop === atDrop,
                roomLeft: atDrop < list.zone.scrollHeight - 90,
            };
        });
        expect(observed).to.deep.equal({ kept: true, stoppedAfterDrop: true, roomLeft: true });
    });

    it("auto-scrolls the iframe's document near the edge of the iframe's viewport", { timeout: 10000 }, async () => {
        let observed;
        const { win, doc, list } = createListInFrame(LONG_OBSERVATION);
        doc.body.style.height = "3000px";
        await withLoadingWindowGlobals(pausedTimers, async () => {
            list.element("a").dispatchEvent(mouse(win, "mousedown", 50, 15));
            win.dispatchEvent(mouse(win, "mousemove", 50, 190));
            await sleepIn(win, 100);
            const first = doc.scrollingElement!.scrollTop;
            await sleepIn(win, 300);
            observed = { started: first > 0, kept: doc.scrollingElement!.scrollTop > first };
        }).finally(() => win.dispatchEvent(mouse(win, "mouseup", 50, 190)));
        expect(observed).to.deep.equal({ started: true, kept: true });
    });

    it("finalizes the drop animation while the loading window's timers never fire", { timeout: 10000 }, async () => {
        let observed;
        const { win, doc, list } = createListInFrame({ flipDurationMs: 100 });
        await withLoadingWindowGlobals(pausedTimers, async () => {
            list.element("a").dispatchEvent(mouse(win, "mousedown", 50, 15));
            win.dispatchEvent(mouse(win, "mousemove", 50, 20));
            await sleepIn(win, 200);
            win.dispatchEvent(mouse(win, "mouseup", 50, 20));
            await sleepIn(win, 400);
            observed = {
                lastTrigger: list.triggers[list.triggers.length - 1],
                draggedEl: doc.getElementById(DRAGGED_ELEMENT_ID),
            };
        });
        expect(observed).to.deep.equal({ lastTrigger: TRIGGERS.DROPPED_INTO_ZONE, draggedEl: null });
    });
});
