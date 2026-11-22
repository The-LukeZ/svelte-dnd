import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { docsmith } from "svelte-docsmith/vite";
import { defineConfig } from "vite";
import libPkg from "@lukez/svelte-dnd/package.json" with { type: "json" };
import { SITE_URL } from "./src/site.ts";
import { apiReference } from "./src/lib/api/vite-plugin.ts";

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
                    href: "/changelog",
                    dismissible: false,
                },
                nav: [
                    { label: "Docs", href: "/docs/getting-started" },
                    { label: "Demos", href: "/docs/demos/basic" },
                    { label: "Changelog", href: "/changelog" },
                ],
            },
            // The library's changesets CHANGELOG.md feeds the /changelog page and /changelog.xml feed.
            changelog: { file: "../../packages/svelte-dnd/CHANGELOG.md" },
        }),
        tailwindcss(),
        // virtual:svelte-dnd-api, the API reference extracted from the library's types and TSDoc
        apiReference(),
        sveltekit({
            extensions: [".svelte", ".md"],
            preprocess: [vitePreprocess()],
            // Pages and assets go in `build`. Every route prerenders. The 404.html fallback is what Cloudflare Pages serves
            // (with status 404) for an unknown path, so +error.svelte renders instead of the home page.
            adapter: adapter({ fallback: "404.html" }),
        }),
    ],
    // Prebundling svelte-docsmith for the browser inlines its fallback modules, which throw without the plugin (such as
    // svelte-docsmith/site), instead of the virtual modules that docsmith() serves. Dev pages then fail in the browser.
    optimizeDeps: { exclude: ["svelte-docsmith"] },
});
