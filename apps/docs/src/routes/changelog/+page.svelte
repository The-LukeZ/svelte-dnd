<script lang="ts">
    import { Changelog, DocsShell } from "svelte-docsmith";
    import { releases } from "svelte-docsmith/changelog";
</script>

<svelte:head>
    <title>Changelog | svelte-dnd</title>
</svelte:head>

<DocsShell search={() => import("svelte-docsmith/search").then((m) => m.docs)} layout="page">
    <div class="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <Changelog
            {releases}
            description="Every release of @lukez/svelte-dnd, generated from the package CHANGELOG.md."
        />
    </div>
</DocsShell>
