<script lang="ts">
    import { content } from "svelte-docsmith/content";
    import { DocsShell, Sidebar, type NavGroup } from "svelte-docsmith";
    import type { Snippet } from "svelte";

    const { children }: { children: Snippet } = $props();

    // Scope the sidebar, pager and breadcrumbs to the /docs section only.
    const sectionContent = { ...content, docs: content.docs.filter((d) => d.path.startsWith("/docs/")) };

    // Plain-text exports of the whole site for LLMs, served by src/routes/llms*.txt. Appended to the sidebar only,
    // so the pager and breadcrumbs never point at them.
    const llmsGroup: NavGroup = {
        title: "For LLMs",
        items: [
            { title: "llms.txt", url: "/llms.txt" },
            { title: "llms-full.txt", url: "/llms-full.txt" },
        ],
    };
</script>

<DocsShell
    content={sectionContent}
    readingTime={false}
    search={() => import("svelte-docsmith/search").then((m) => m.docs)}
    copyPage
>
    {#snippet sidebar({ nav })}
        <Sidebar nav={[...nav, llmsGroup]} />
    {/snippet}
    {@render children()}
</DocsShell>
