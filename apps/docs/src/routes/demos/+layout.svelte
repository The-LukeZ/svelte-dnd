<script lang="ts">
    import { content } from "svelte-docsmith/content";
    import { DocsShell } from "svelte-docsmith";
    import type { Snippet } from "svelte";

    const { children }: { children: Snippet } = $props();

    // Scope the sidebar, pager and breadcrumbs to the /demos section only.
    const sectionContent = { ...content, docs: content.docs.filter((d) => d.path.startsWith("/demos/")) };
</script>

<DocsShell
    content={sectionContent}
    readingTime={false}
    search={() => import("svelte-docsmith/search").then((m) => m.docs)}
    copyPage
>
    {@render children()}
</DocsShell>
