import { createMultiScroller } from "../src/helpers/multiScroller";

describe("multiScroller", () => {
    it("scrolls a document that only overflows horizontally and is taller than its scroll width", async () => {
        // A portrait viewport: the document is 450px wide in a 300px wide, 600px tall window
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "width: 300px; height: 600px; border: 0";
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument!;
        doc.body.style.margin = "0";
        const zone = doc.createElement("div");
        zone.style.cssText = "width: 450px; height: 10px";
        doc.body.appendChild(zone);
        const { scrollingElement } = doc as Document & { scrollingElement: HTMLElement };
        expect(scrollingElement.scrollWidth, "the document should overflow horizontally").to.be.greaterThan(
            scrollingElement.clientWidth,
        );
        expect(scrollingElement.scrollWidth, "the case the bug missed").to.be.lessThanOrEqual(
            scrollingElement.clientHeight,
        );

        const scroller = createMultiScroller([zone], () => ({ x: 290, y: 100 }));
        try {
            expect(scroller.multiScrollIfNeeded(), "the pointer is at the right edge").to.equal(true);
        } finally {
            scroller.destroy();
            iframe.remove();
        }
    });
});
