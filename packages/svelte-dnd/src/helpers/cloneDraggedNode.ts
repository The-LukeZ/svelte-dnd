/**
 * Clones the dragged element for the drag image. `cloneNode` does not copy live form and canvas state: a clone shows
 * its `<select>` at the first option and its `<canvas>` blank, whatever the framework. This copies both over.
 */
export function cloneDraggedNode(el: HTMLElement): HTMLElement {
    const cloned = el.cloneNode(true) as HTMLElement; // a clone of an HTMLElement

    const values: string[] = [];
    const elIsSelect = el.tagName === "SELECT";
    const selects = elIsSelect ? [el as HTMLSelectElement] : [...el.querySelectorAll("select")];
    for (const select of selects) {
        values.push(select.value);
    }

    if (selects.length > 0) {
        const clonedSelects = elIsSelect ? [cloned as HTMLSelectElement] : [...cloned.querySelectorAll("select")];
        for (let i = 0; i < clonedSelects.length; i++) {
            const select = clonedSelects[i];
            const value = values[i];
            const optionEl = select.querySelector(`option[value="${value}"`);
            if (optionEl) {
                // the DOM turns the boolean into the string "true"
                optionEl.setAttribute("selected", true as unknown as string);
            }
        }
    }

    const elIsCanvas = el.tagName === "CANVAS";
    const canvases = elIsCanvas ? [el as HTMLCanvasElement] : [...el.querySelectorAll("canvas")];
    if (canvases.length > 0) {
        const clonedCanvases = elIsCanvas ? [cloned as HTMLCanvasElement] : [...cloned.querySelectorAll("canvas")];
        for (let i = 0; i < clonedCanvases.length; i++) {
            const canvas = canvases[i];
            const clonedCanvas = clonedCanvases[i];
            clonedCanvas.width = canvas.width;
            clonedCanvas.height = canvas.height;
            if (canvas.width > 0 && canvas.height > 0) {
                // the clone has no context yet, so getContext("2d") returns one
                clonedCanvas.getContext("2d")!.drawImage(canvas, 0, 0);
            }
        }
    }

    return cloned;
}
