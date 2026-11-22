import { normalizePath, type Plugin } from "vite";
import { extractApi } from "./extract.ts";

const VIRTUAL_ID = "virtual:svelte-dnd-api";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Serves `virtual:svelte-dnd-api`: the library's API reference, extracted from its types and TSDoc at build time.
 * A missing description fails the build with an ApiDocError. In dev, a change to the library's sources reloads it.
 */
export function apiReference(): Plugin {
    // The library's source folder, with a trailing slash, from the docs app's root. normalizePath resolves the "..".
    let libSrc = "";
    return {
        name: "svelte-dnd-api-reference",
        configResolved(config) {
            libSrc = `${normalizePath(`${config.root}/../../packages/svelte-dnd/src`)}/`;
        },
        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
        },
        load(id) {
            if (id !== RESOLVED_ID) return undefined;
            return `export default ${JSON.stringify(extractApi(`${libSrc}index.ts`))};`;
        },
        configureServer(server) {
            server.watcher.add(libSrc);
            const onChange = (file: string): void => {
                const path = normalizePath(file);
                if (!path.startsWith(libSrc) || !path.endsWith(".ts")) return;
                let invalidated = false;
                for (const environment of Object.values(server.environments)) {
                    const mod = environment.moduleGraph.getModuleById(RESOLVED_ID);
                    if (!mod) continue;
                    environment.moduleGraph.invalidateModule(mod);
                    invalidated = true;
                }
                if (invalidated) server.ws.send({ type: "full-reload" });
            };
            server.watcher.on("change", onChange);
            server.watcher.on("add", onChange);
            server.watcher.on("unlink", onChange);
        },
    };
}
