import { SOURCES, TRIGGERS } from "../src";
import type { DndEvent, DndEventInfo, Item } from "../src/types";
import {
    dispatchFinalizeEvent,
    dispatchConsiderEvent,
    registerZoneCallbacks,
    unregisterZoneCallbacks,
} from "../src/helpers/dispatcher";

describe("dispatcher", () => {
    let el: HTMLElement;
    // the dispatcher passes items through untouched, so plain numbers are enough for the contract
    const myItems = [1, 2] as unknown as Item[];
    const myInfo: DndEventInfo = { trigger: TRIGGERS.DROPPED_INTO_ZONE, id: "someId", source: SOURCES.POINTER };
    beforeEach(() => {
        el = document.createElement("div");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls onfinalize with items and info", () => {
        const received: DndEvent[] = [];
        registerZoneCallbacks(el, { onfinalize: (e) => received.push(e) });
        dispatchFinalizeEvent(el, myItems, myInfo);
        expect(received).to.deep.equal([{ items: [1, 2], info: myInfo }]);
    });

    it("calls onconsider with items and info", () => {
        const received: DndEvent[] = [];
        const info: DndEventInfo = { trigger: TRIGGERS.DRAGGED_ENTERED, id: "someId", source: SOURCES.KEYBOARD };
        registerZoneCallbacks(el, { onconsider: (e) => received.push(e) });
        dispatchConsiderEvent(el, myItems, info);
        expect(received).to.deep.equal([{ items: [1, 2], info }]);
    });

    it("dispatches no DOM consider or finalize event", () => {
        const considerSpy = vi.fn();
        const finalizeSpy = vi.fn();
        el.addEventListener("consider", considerSpy);
        el.addEventListener("finalize", finalizeSpy);
        registerZoneCallbacks(el, { onconsider: () => {}, onfinalize: () => {} });
        dispatchConsiderEvent(el, myItems, myInfo);
        dispatchFinalizeEvent(el, myItems, myInfo);
        expect(considerSpy).not.toHaveBeenCalled();
        expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it("calls nothing after unregister", () => {
        const onconsider = vi.fn();
        const onfinalize = vi.fn();
        registerZoneCallbacks(el, { onconsider, onfinalize });
        unregisterZoneCallbacks(el);
        dispatchConsiderEvent(el, myItems, myInfo);
        dispatchFinalizeEvent(el, myItems, myInfo);
        expect(onconsider).not.toHaveBeenCalled();
        expect(onfinalize).not.toHaveBeenCalled();
    });

    it("reports a throwing callback and returns normally", () => {
        const reportError = vi.spyOn(window, "reportError").mockImplementation(() => {});
        const error = new Error("boom");
        registerZoneCallbacks(el, {
            onconsider: () => {
                throw error;
            },
        });
        expect(() => dispatchConsiderEvent(el, myItems, myInfo)).not.to.throw();
        expect(reportError).toHaveBeenCalledOnce();
        expect(reportError).toHaveBeenCalledWith(error);
    });
});
