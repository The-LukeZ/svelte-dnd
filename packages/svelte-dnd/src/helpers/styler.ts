import { SHADOW_ELEMENT_ATTRIBUTE_NAME, DRAGGED_ELEMENT_ID } from "../constants";
import { findCenter, type Point } from "./intersection";
import { svelteNodeClone } from "./svelteNodeClone";
import { getFeatureFlag, FEATURE_FLAG_NAMES } from "../featureFlags";
import { getWindowOf } from "./util";

const TRANSITION_DURATION_SECONDS = 0.2;

type Styles = Record<string, string>;
// lib.dom only knows webkitUserSelect, the property the code sets is WebkitUserSelect
type StyleWithWebkitUserSelect = CSSStyleDeclaration & { WebkitUserSelect: string };
// the default of getStyles returns nothing
type GetStyles = (dz: HTMLElement) => Styles | void;
type GetClasses = (dz: HTMLElement) => string[];

/**
 * private helper function - creates a transition string for a property
 * @return the transition string
 */
function trs(property: string): string {
    return `${property} ${TRANSITION_DURATION_SECONDS}s ease`;
}

/**
 * Adds the size transitions after the dragged element's initial styles have been applied.
 * This normally happens in a timeout to avoid a browser rendering bug, but a synchronous
 * first morph can happen before that timeout and needs the transitions immediately.
 */
function ensureMorphSizeTransitions(draggedEl: HTMLElement): void {
    const transitionProperties = draggedEl.style.transitionProperty.split(",").map((property) => property.trim());
    if (transitionProperties.includes("all")) return;
    if (!transitionProperties.includes("width")) draggedEl.style.transition += `, ${trs("width")}`;
    if (!transitionProperties.includes("height")) draggedEl.style.transition += `, ${trs("height")}`;
}
/**
 * clones the given element and applies proper styles and transitions to the dragged element
 * @return the cloned, styled element
 */
export function createDraggedElementFrom(originalElement: HTMLElement, positionCenterOnXY?: Point): HTMLElement {
    const rect = originalElement.getBoundingClientRect();
    const win = getWindowOf(originalElement);
    const draggedEl = svelteNodeClone(originalElement);
    copyStylesFromTo(originalElement, draggedEl);
    draggedEl.id = DRAGGED_ELEMENT_ID;
    draggedEl.style.position = "fixed";
    let elTopPx = rect.top;
    let elLeftPx = rect.left;
    draggedEl.style.top = `${elTopPx}px`;
    draggedEl.style.left = `${elLeftPx}px`;
    if (positionCenterOnXY) {
        const center = findCenter(rect);
        elTopPx -= center.y - positionCenterOnXY.y;
        elLeftPx -= center.x - positionCenterOnXY.x;
        win.setTimeout(() => {
            draggedEl.style.top = `${elTopPx}px`;
            draggedEl.style.left = `${elLeftPx}px`;
        }, 0);
    }
    draggedEl.style.margin = "0";
    // we can't have relative or automatic height and width or it will break the illusion
    draggedEl.style.boxSizing = "border-box";
    draggedEl.style.height = `${rect.height}px`;
    draggedEl.style.width = `${rect.width}px`;
    draggedEl.style.transition = `${trs("top")}, ${trs("left")}, ${trs("background-color")}, ${trs("opacity")}, ${trs("color")} `;
    // this is a workaround for a strange browser bug that causes the right border to disappear when all the transitions are added at the same time
    win.setTimeout(() => ensureMorphSizeTransitions(draggedEl), 0);
    draggedEl.style.zIndex = "9999";
    draggedEl.style.cursor = "grabbing";

    return draggedEl;
}

/**
 * styles the dragged element to a 'dropped' state
 */
export function moveDraggedElementToWasDroppedState(draggedEl: HTMLElement): void {
    draggedEl.style.cursor = "grab";
}

/**
 * Morphs the dragged element style, maintains the mouse pointer within the element
 * @param copyFromEl - the element the dragged element should look like, typically the shadow element
 */
export function morphDraggedElementToBeLike(
    draggedEl: HTMLElement,
    copyFromEl: HTMLElement,
    currentMouseX: number,
    currentMouseY: number,
): void {
    ensureMorphSizeTransitions(draggedEl);
    copyStylesFromTo(copyFromEl, draggedEl);
    const newRect = copyFromEl.getBoundingClientRect();
    const draggedElRect = draggedEl.getBoundingClientRect();
    const draggedElComputedStyle = getWindowOf(draggedEl).getComputedStyle(draggedEl);
    const currentLeft = parseFloat(draggedElComputedStyle.left);
    const currentTop = parseFloat(draggedElComputedStyle.top);
    const widthChange = newRect.width - draggedElRect.width;
    const heightChange = newRect.height - draggedElRect.height;
    if (widthChange || heightChange) {
        const relativeDistanceOfMousePointerFromDraggedSides = {
            left: draggedElRect.width ? (currentMouseX - draggedElRect.left) / draggedElRect.width : 0,
            top: draggedElRect.height ? (currentMouseY - draggedElRect.top) / draggedElRect.height : 0,
        };
        if (!getFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT)) {
            draggedEl.style.height = `${newRect.height}px`;
            draggedEl.style.width = `${newRect.width}px`;
        }
        draggedEl.style.left = `${currentLeft - relativeDistanceOfMousePointerFromDraggedSides.left * widthChange}px`;
        draggedEl.style.top = `${currentTop - relativeDistanceOfMousePointerFromDraggedSides.top * heightChange}px`;
    }
}

function copyStylesFromTo(copyFromEl: HTMLElement, copyToEl: HTMLElement): void {
    const computedStyle = getWindowOf(copyFromEl).getComputedStyle(copyFromEl);
    Array.from(computedStyle)
        .filter(
            (s) =>
                s.startsWith("background") ||
                s.startsWith("padding") ||
                s.startsWith("font") ||
                s.startsWith("text") ||
                s.startsWith("align") ||
                s.startsWith("justify") ||
                s.startsWith("display") ||
                s.startsWith("flex") ||
                s.startsWith("border") ||
                s === "opacity" ||
                s === "color" ||
                s === "list-style-type" ||
                // copying with and height to make up for rect update timing issues in some browsers
                (getFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT) &&
                    (s === "width" || s === "height")),
        )
        .forEach((s) =>
            copyToEl.style.setProperty(s, computedStyle.getPropertyValue(s), computedStyle.getPropertyPriority(s)),
        );
}

/**
 * makes the element compatible with being draggable
 */
export function styleDraggable(draggableEl: HTMLElement, dragDisabled: boolean): void {
    draggableEl.draggable = false;
    draggableEl.ondragstart = () => false;
    if (!dragDisabled) {
        draggableEl.style.userSelect = "none";
        (draggableEl.style as StyleWithWebkitUserSelect).WebkitUserSelect = "none";
        draggableEl.style.cursor = "grab";
    } else {
        draggableEl.style.userSelect = "";
        (draggableEl.style as StyleWithWebkitUserSelect).WebkitUserSelect = "";
        draggableEl.style.cursor = "";
    }
}

/**
 * Hides the provided element so that it can stay in the dom without interrupting
 */
export function hideElement(dragTarget: HTMLElement): void {
    dragTarget.style.display = "none";
    dragTarget.style.position = "fixed";
    dragTarget.style.zIndex = "-5";
}

/**
 * styles the shadow element
 */
export function decorateShadowEl(shadowEl: HTMLElement): void {
    shadowEl.style.visibility = "hidden";
    shadowEl.setAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME, "true");
}

/**
 * undo the styles the shadow element
 */
export function unDecorateShadowElement(shadowEl: HTMLElement): void {
    shadowEl.style.visibility = "";
    shadowEl.removeAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME);
}

/**
 * will mark the given dropzones as visually active
 * @param getStyles - maps a dropzone to a styles object (so the styles can be removed)
 * @param getClasses - maps a dropzone to a classList
 */
export function styleActiveDropZones(
    dropZones: Array<HTMLElement>,
    getStyles: GetStyles = () => {},
    getClasses: GetClasses = () => [],
): void {
    dropZones.forEach((dz) => {
        // callers always pass getStyles, only its default returns nothing
        const styles = getStyles(dz) as Styles;
        Object.keys(styles).forEach((style) => {
            // the keys of the styles object are CSS property names
            (dz.style as unknown as Styles)[style] = styles[style];
        });
        getClasses(dz).forEach((c) => dz.classList.add(c));
    });
}

/**
 * will remove the 'active' styling from given dropzones
 * @param getStyles - maps a dropzone to a styles object
 * @param getClasses - maps a dropzone to a classList
 */
export function styleInactiveDropZones(
    dropZones: Array<HTMLElement>,
    getStyles: GetStyles = () => {},
    getClasses: GetClasses = () => [],
): void {
    dropZones.forEach((dz) => {
        // callers always pass getStyles, only its default returns nothing
        const styles = getStyles(dz) as Styles;
        Object.keys(styles).forEach((style) => {
            // the keys of the styles object are CSS property names
            (dz.style as unknown as Styles)[style] = "";
        });
        getClasses(dz).forEach((c) => dz.classList.contains(c) && dz.classList.remove(c));
    });
}

/**
 * will prevent the provided element from shrinking by setting its minWidth and minHeight to the current width and height values
 * @return run this function to undo the operation and restore the original values
 */
export function preventShrinking(el: HTMLElement): () => void {
    const originalMinHeight = el.style.minHeight;
    const computedStyle = getWindowOf(el).getComputedStyle(el);
    el.style.minHeight = computedStyle.getPropertyValue("height");
    const originalMinWidth = el.style.minWidth;
    el.style.minWidth = computedStyle.getPropertyValue("width");
    return function undo() {
        el.style.minHeight = originalMinHeight;
        el.style.minWidth = originalMinWidth;
    };
}
