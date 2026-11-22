<script lang="ts">
    import reference from "virtual:svelte-dnd-api";

    const { name }: { name: string } = $props();

    const entry = $derived.by(() => {
        const found = reference[name];
        // Throwing here fails the prerender, so a page cannot name an export that does not exist.
        if (!found) throw new Error("Unknown API entry: " + name);
        return found;
    });

    /** Splits TSDoc text on `code` spans, so they render as code without parsing HTML. */
    function segments(text: string): { code: boolean; text: string }[] {
        return text
            .split(/(`[^`]+`)/)
            .map((part) =>
                part.startsWith("`") && part.endsWith("`") && part.length > 1
                    ? { code: true, text: part.slice(1, -1) }
                    : { code: false, text: part },
            );
    }
</script>

{#snippet rich(text: string)}
    {#each segments(text) as part, i (i)}{#if part.code}<code>{part.text}</code>{:else}{part.text}{/if}{/each}
{/snippet}

<div class="api-entry">
    {#each entry.description.split(/\n\s*\n/) as paragraph, i (i)}
        <p>{@render rich(paragraph)}</p>
    {/each}

    <pre class="api-signature"><code>{entry.signature}</code></pre>

    {#if entry.properties.length > 0}
        <table class="api-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                {#each entry.properties as property (property.name)}
                    <tr>
                        <td><code>{property.name}{property.optional ? "?" : ""}</code></td>
                        <td><code class="api-type">{property.type}</code></td>
                        <td>
                            {#if property.default !== undefined}<code>{property.default}</code>{:else}-{/if}
                        </td>
                        <td>{@render rich(property.description)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .api-signature {
        overflow-x: auto;
        white-space: pre;
    }

    .api-table {
        display: block;
        overflow-x: auto;
    }

    .api-type {
        white-space: pre-wrap;
    }
</style>
