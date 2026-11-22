<script lang="ts">
    import { Action, CTA, DocsShell, Feature, FeatureGrid, Hero } from "svelte-docsmith";
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
        <pre class="bg-muted overflow-x-auto rounded-lg border px-4 py-3 text-center font-mono text-sm"><code
                >pnpm add @lukez/svelte-dnd@next</code
            ></pre>
    </div>

    <!-- Task 10: the Basic demo goes here, between the install command and the features. -->

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
