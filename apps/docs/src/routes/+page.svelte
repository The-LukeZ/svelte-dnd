<script lang="ts">
    import { Action, CTA, DocsShell, Feature, FeatureGrid, Hero } from "svelte-docsmith";
    import Basic from "#lib/demos/Basic.svelte";

    const installCommand = "pnpm add @lukez/svelte-dnd@next";
    let copied = $state(false);

    async function copyInstallCommand() {
        try {
            await navigator.clipboard.writeText(installCommand);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            // The clipboard can be blocked. The command stays selectable in the box.
        }
    }
</script>

<DocsShell search={() => import("svelte-docsmith/search").then((m) => m.docs)} layout="page">
    <Hero
        title="Drag and drop for Svelte 5"
        description="Sortable lists, boards and trees from one attachment: nested zones, touch, keyboard and screen reader support. You own the items, the library proposes the changes."
    >
        {#snippet actions()}
            <Action href="/docs/getting-started">Get started</Action>
            <Action href="/docs/how-it-works" variant="secondary">How it works</Action>
        {/snippet}
    </Hero>

    <div class="mx-auto max-w-xl px-4 pb-16 md:px-6">
        <div class="bg-muted flex items-center gap-2 rounded-lg border py-2 pr-2 pl-4">
            <pre class="flex-1 overflow-x-auto font-mono text-sm"><code>{installCommand}</code></pre>
            <button
                type="button"
                class="hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-md border px-2.5 py-1 text-xs font-medium"
                onclick={copyInstallCommand}
            >
                {copied ? "Copied" : "Copy"}<span class="sr-only"> the install command</span>
            </button>
        </div>
    </div>

    <div class="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 pb-16 md:px-6">
        <Basic />
        <a class="text-sm underline underline-offset-4" href="/docs/demos/basic">More demos</a>
    </div>

    <FeatureGrid title="What you get" columns={3}>
        <Feature title="Any layout">
            Vertical, horizontal or grid lists. The zone does not care about the shape of its container.
        </Feature>
        <Feature title="Nested zones">
            Draggable containers with draggable items inside, like the columns and cards of a board.
        </Feature>
        <Feature title="Typed zones">
            Give zones a type to define what can be dropped where, or let every zone accept every item.
        </Feature>
        <Feature title="Pointer, touch and keyboard">
            One drag model for the mouse, touch screens and the keyboard, with auto-scroll near the edges.
        </Feature>
        <Feature title="Accessible">
            ARIA attributes, instructions and live announcements for screen readers, which you can translate.
        </Feature>
        <Feature title="Small and flexible">
            No dependencies. Animate with flip, use drag handles, copy on drag, or drag between iframes and windows.
        </Feature>
    </FeatureGrid>

    <CTA
        title="Make your first list draggable"
        description="Install the package and have a sortable list in a few lines."
    >
        {#snippet actions()}
            <Action href="/docs/getting-started">Get started</Action>
        {/snippet}
    </CTA>
</DocsShell>
