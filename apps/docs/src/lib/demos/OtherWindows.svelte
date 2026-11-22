<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone, type DndEvent } from "@lukez/svelte-dnd";

    type Task = { id: string; name: string };
    type Board = { todo: Task[]; done: Task[] };
    type Place = "page" | "frame" | "popup";

    const flipDurationMs = 150;

    // Item ids stay unique across all the zones of a type, even when the zones are in different documents.
    const makeBoard = (place: Place): Board => ({
        todo: [
            { id: `${place}-plan`, name: "Plan the release" },
            { id: `${place}-build`, name: "Build it" },
            { id: `${place}-test`, name: "Test with a keyboard" },
        ],
        done: [{ id: `${place}-read`, name: "Read the docs" }],
    });

    // One state for the three boards. The component, its state and the library all live in this page;
    // the iframe and the popup only get the elements.
    const boards = $state<Record<Place, Board>>({
        page: makeBoard("page"),
        frame: makeBoard("frame"),
        popup: makeBoard("popup"),
    });

    let showFrame = $state(false);
    let frameDoc = $state<Document>();
    let popupDoc = $state<Document>();
    // Whether the lists' wrapper is in the other document yet (see moveInto).
    const moved = $state({ frame: false, popup: false });
    let message = $state("");

    // The iframe renders in the browser only, so its load event cannot fire before hydration.
    $effect(() => {
        showFrame = true;
    });

    // The elements keep the page's class names, so the other document needs the page's stylesheets and
    // its theme class (dark mode).
    function shareStyles(doc: Document): () => void {
        for (const sheet of document.head.querySelectorAll<HTMLElement>("link[rel='stylesheet'], style")) {
            const copy = doc.importNode(sheet, true);
            if (copy instanceof HTMLLinkElement) copy.href = (sheet as HTMLLinkElement).href;
            doc.head.append(copy);
        }
        const syncTheme = () => {
            doc.documentElement.className = document.documentElement.className;
            doc.documentElement.style.cssText = document.documentElement.style.cssText;
        };
        syncTheme();
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
        return () => observer.disconnect();
    }

    // Moves the wrapper Svelte rendered here into the other document, and only then lets the lists render
    // inside it, so each zone starts out in its final document. dndzone works with the zone's own document
    // and window: its zones follow the pointer, the keyboard and the screen reader there.
    function moveInto(doc: Document, place: "frame" | "popup") {
        return (element: HTMLElement) => {
            const stopSharing = shareStyles(doc);
            doc.body.append(element);
            moved[place] = true;
            return () => {
                moved[place] = false;
                stopSharing();
            };
        };
    }

    function loadFrame(e: Event) {
        const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
        if (doc) frameDoc = doc;
    }

    function openPopup() {
        const current = popupDoc?.defaultView;
        if (current && !current.closed) {
            current.focus();
            return;
        }
        const popup = window.open("", "", "popup,width=640,height=360");
        if (!popup) {
            message = "The browser blocked the popup. Allow popups for this site to try it.";
            return;
        }
        message = "";
        popup.document.title = "Popup lists";
        popup.document.documentElement.lang = "en";
        // Closing the popup removes its lists here as well.
        popup.addEventListener("pagehide", () => (popupDoc = undefined), { once: true });
        popupDoc = popup.document;
    }

    // Closes the popup when its lists go away or this page unloads: the lists run on this page's code.
    function closeWithPage(element: HTMLElement) {
        const close = () => element.ownerDocument.defaultView?.close();
        window.addEventListener("pagehide", close);
        return () => {
            window.removeEventListener("pagehide", close);
            close();
        };
    }

    function update(place: Place, list: keyof Board, e: DndEvent<Task>) {
        boards[place][list] = e.items;
    }
</script>

{#snippet zone(place: Place, list: keyof Board, title: string, name: string)}
    <div class="flex min-w-0 flex-col gap-1">
        <h4 class="text-xs font-medium">{name}</h4>
        <div
            aria-label="{title}: {name}"
            class="bg-muted flex min-h-32 flex-col gap-2 rounded-md border p-2"
            {@attach dndzone(() => ({
                items: boards[place][list],
                type: "tasks",
                flipDurationMs,
                onconsider: (e) => update(place, list, e),
                onfinalize: (e) => update(place, list, e),
            }))}
        >
            {#each boards[place][list] as task (task.id)}
                <div
                    aria-label={task.name}
                    class="bg-card text-card-foreground rounded-md border px-3 py-2 text-sm"
                    animate:flip={{ duration: flipDurationMs }}
                >
                    {task.name}
                </div>
            {/each}
        </div>
    </div>
{/snippet}

{#snippet board(place: Place, title: string)}
    <section aria-label={title} class="flex flex-col gap-2 p-3">
        <h3 class="text-sm font-semibold">{title}</h3>
        <div class="grid grid-cols-2 gap-3">
            {@render zone(place, "todo", title, "To do")}
            {@render zone(place, "done", title, "Done")}
        </div>
    </section>
{/snippet}

<div class="not-prose flex w-full min-w-0 flex-col gap-3">
    {@render board("page", "This page")}

    {#if showFrame}
        <iframe
            title="Lists in a same-origin iframe"
            class="h-56 w-full rounded-md border"
            srcdoc="<!doctype html><html lang='en'><head><title>Iframe lists</title></head><body style='margin:0'></body></html>"
            onload={loadFrame}
        ></iframe>
    {/if}
    {#if frameDoc}
        <div {@attach moveInto(frameDoc, "frame")}>
            {#if moved.frame}
                {@render board("frame", "Same-origin iframe")}
            {/if}
        </div>
    {/if}

    <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm" onclick={openPopup}>Open popup</button>
        <p class="text-muted-foreground text-sm" role="status">{message}</p>
    </div>
    {#if popupDoc}
        <div
            class="bg-background text-foreground min-h-screen"
            {@attach moveInto(popupDoc, "popup")}
            {@attach closeWithPage}
        >
            {#if moved.popup}
                {@render board("popup", "Popup window")}
            {/if}
        </div>
    {/if}
</div>
