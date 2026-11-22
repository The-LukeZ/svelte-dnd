import { llmsFullTxt } from "svelte-docsmith/server";
import reference from "virtual:svelte-dnd-api";
import { withApiTables } from "#lib/api/markdown.ts";
import type { RequestHandler } from "./$types";

// Every page's agent markdown in one file, with the <ApiTable /> tags written out as markdown tables.
export const prerender = true;
const full = llmsFullTxt();
export const GET: RequestHandler = () => withApiTables(full(), reference);
