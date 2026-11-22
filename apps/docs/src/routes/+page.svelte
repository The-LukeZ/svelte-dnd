<script lang="ts">
    import { Action, DocsShell, Hero } from "svelte-docsmith";
</script>

<!-- Placeholder landing page. Task 9 finishes it. -->
<DocsShell search={() => import("svelte-docsmith/search").then((m) => m.docs)} layout="page">
    <Hero
        title="svelte-dnd"
        description="Drag and drop for Svelte 5: nested zones, touch, keyboard and screen reader support."
    >
        {#snippet actions()}
            <Action href="/docs/introduction">Read the docs</Action>
        {/snippet}
    </Hero>
</DocsShell>
