<script lang="ts" module>
    /**
     * A custom element that keeps its state in a JS property and renders it into its shadow root, the way Lit
     * components do (upstream isaacHagoel/svelte-dnd-action#394). cloneNode copies attributes only, so a clone of it
     * starts with the default label.
     */
    class DndLabel extends HTMLElement {
        #label = "(no label)";
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.#render();
        }
        get label(): string {
            return this.#label;
        }
        set label(value: string) {
            this.#label = value;
            this.#render();
        }
        #render(): void {
            this.shadowRoot!.textContent = this.#label;
        }
    }
    if (!customElements.get("x-dnd-label")) customElements.define("x-dnd-label", DndLabel);
</script>

<script lang="ts">
    import { dndzone } from "../../../src/action";
    import type { DndEvent, TransformDraggedElementFunction } from "../../../src/types";

    type Row = { id: number; name: string };

    let {
        initial,
        transformDraggedElement,
        onCall,
    }: {
        initial: Row[];
        transformDraggedElement?: TransformDraggedElementFunction<Row>;
        onCall?: (kind: "consider" | "finalize", detail: DndEvent<Row>) => void;
    } = $props();

    // svelte-ignore state_referenced_locally
    let items = $state(initial);
</script>

<ul
    data-testid="zone"
    {@attach dndzone(() => ({
        items,
        flipDurationMs: 0,
        transformDraggedElement,
        onconsider: (detail: DndEvent<Row>) => {
            items = detail.items;
            onCall?.("consider", detail);
        },
        onfinalize: (detail: DndEvent<Row>) => {
            items = detail.items;
            onCall?.("finalize", detail);
        },
    }))}
>
    <!-- Svelte sets `label` as a property, since the element defines one -->
    {#each items as item (item.id)}<li><x-dnd-label label={item.name}></x-dnd-label></li>{/each}
</ul>
