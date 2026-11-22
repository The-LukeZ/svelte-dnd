import { render } from "vitest-browser-svelte";
import { DRAGGED_ELEMENT_ID } from "../../src/constants";
import type { DndEvent } from "../../src/types";
import SelectItem from "./fixtures/SelectItem.svelte";
import { mouse } from "./helpers";

describe("dragged clone", () => {
    let errors: string[];
    const onError = (e: ErrorEvent): number => errors.push(e.message);
    beforeEach(() => {
        errors = [];
        window.addEventListener("error", onError);
    });
    afterEach(() => {
        window.removeEventListener("error", onError);
        expect(errors, "errors thrown by listeners").to.deep.equal([]);
    });

    it("the dragged clone shows the select's current value", async () => {
        const calls: { kind: string; detail: DndEvent }[] = [];
        const screen = await render(SelectItem, {
            onCall: (kind: string, detail: DndEvent) => calls.push({ kind, detail }),
        });
        const select = screen.getByTestId("select-1").element() as HTMLSelectElement;
        select.value = "3";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        // the clone assertion below only means something when the live select holds the changed value
        expect(select.value).to.equal("3");

        const li = select.closest("li")!;
        const rect = li.getBoundingClientRect();
        const x = rect.left + 5;
        const y = rect.top + rect.height / 2;
        li.dispatchEvent(mouse("mousedown", x, y));
        try {
            window.dispatchEvent(mouse("mousemove", x, y + 5));
            await vi.waitFor(() => expect(calls.length, "the drag should start").to.be.greaterThan(0));
            const clonedSelect = document.querySelector<HTMLSelectElement>(`#${DRAGGED_ELEMENT_ID} select`);
            expect(clonedSelect, "the dragged clone has a select").to.not.equal(null);
            expect(clonedSelect!.value).to.equal("3");
        } finally {
            window.dispatchEvent(mouse("mouseup", x, y));
        }
        await vi.waitFor(() => expect(calls[calls.length - 1].kind).to.equal("finalize"));
    });
});
