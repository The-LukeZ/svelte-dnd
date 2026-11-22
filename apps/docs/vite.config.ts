import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { docsmith } from "svelte-docsmith/vite";
import { defineConfig } from "vite";
import libPkg from "@lukez/svelte-dnd/package.json" with { type: "json" };
import { SITE_URL } from "./src/site.ts";

export default defineConfig({
    plugins: [
        docsmith({
            site: {
                title: "svelte-dnd",
                description: "Drag and drop for Svelte 5: nested zones, touch, keyboard and screen reader support.",
                url: SITE_URL,
                github: "https://github.com/The-LukeZ/svelte-dnd",
                editUrl: "https://github.com/The-LukeZ/svelte-dnd/edit/dev/apps/docs",
                version: libPkg.version,
                // Every doc page's own OG image, served by src/routes/og/[...slug].png.
                ogImages: "/og",
                announcement: {
                    tag: "Prerelease",
                    text: "The API may change before 1.0. See the changelog.",
                    href: "https://github.com/The-LukeZ/svelte-dnd/blob/dev/packages/svelte-dnd/CHANGELOG.md",
                    external: true,
                    dismissible: false,
                },
                // The Demos link ({ label: "Demos", href: "/docs/demos/basic" }) is added with the first demo page:
                // prerendering fails on a link to a page that does not exist yet.
                nav: [{ label: "Docs", href: "/docs/introduction" }],
            },
        }),
        tailwindcss(),
        sveltekit({
            extensions: [".svelte", ".md"],
            preprocess: [vitePreprocess()],
            // Defaults: pages and assets in `build`, no fallback. Every route prerenders.
            adapter: adapter(),
        }),
    ],
});
