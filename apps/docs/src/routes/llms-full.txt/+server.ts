import { llmsFullTxt } from "svelte-docsmith/server";
import reference from "virtual:svelte-dnd-api";
import notes from "../../../../../archive/upstream-release-notes.md?raw";
import { withApiTables, withUpstreamNotes } from "#lib/api/markdown.ts";
import type { RequestHandler } from "./$types";

// Every page's agent markdown in one file, with the <ApiTable /> tags written out as markdown tables and the history
// page's <Notes /> tag replaced by the upstream release notes.
export const prerender = true;
const full = llmsFullTxt();
export const GET: RequestHandler = async () => withApiTables(await withUpstreamNotes(await full(), notes), reference);
