import { SOURCES, TRIGGERS } from "../src";
import type { DndEvent, DndEventInfo, Item } from "../src/types";
import { dispatchFinalizeEvent, dispatchConsiderEvent } from "../src/helpers/dispatcher";

describe("dispatcher", () => {
    let divEl = document.createElement("div");
    let items: Item[];
    let info: Partial<DndEventInfo>;
    beforeEach(() => {
        items = [];
        info = {};
    });
    it("honors contract - finalize", () => {
        divEl.addEventListener("finalize", (e) => {
            items = (e as CustomEvent<DndEvent>).detail.items;
            info = (e as CustomEvent<DndEvent>).detail.info;
        });
        // the dispatcher passes items through untouched, so plain numbers are enough for the contract
        const myItems = [1, 2] as unknown as Item[];
        const myInfo = { trigger: TRIGGERS.DROPPED_INTO_ZONE, id: "someId", source: SOURCES.POINTER };
        dispatchFinalizeEvent(divEl, myItems, myInfo);
        expect(items).to.deep.equal(myItems);
        expect(info).to.deep.equal(myInfo);
    });
    it("honors contract - consider", () => {
        divEl.addEventListener("consider", (e) => {
            items = (e as CustomEvent<DndEvent>).detail.items;
            info = (e as CustomEvent<DndEvent>).detail.info;
        });
        const myItems = [3, 4] as unknown as Item[];
        const myInfo = { trigger: TRIGGERS.DRAGGED_ENTERED, id: "someId", source: SOURCES.KEYBOARD };
        dispatchConsiderEvent(divEl, myItems, myInfo);
        expect(items).to.deep.equal(myItems);
        expect(info).to.deep.equal(myInfo);
    });
});
