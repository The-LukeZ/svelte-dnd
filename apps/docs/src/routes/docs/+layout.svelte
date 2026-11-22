<script lang="ts">
    import { content } from "svelte-docsmith/content";
    import { DocsShell } from "svelte-docsmith";
    import type { Snippet } from "svelte";

    const { children }: { children: Snippet } = $props();
</script>

<DocsShell {content} readingTime={false} search={() => import("svelte-docsmith/search").then((m) => m.docs)} copyPage>
    {@render children()}
</DocsShell>
