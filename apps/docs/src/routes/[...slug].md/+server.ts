import { agentMarkdown } from "svelte-docsmith/server";
import reference from "virtual:svelte-dnd-api";
import { withApiTables } from "#lib/api/markdown.ts";
import type { RequestHandler } from "./$types";

// Every page's agent markdown at `<path>.md`, which the copy page menu also reads. `entries` lists every page so the
// twins prerender even if nothing links to them. docsmith keeps the <ApiTable /> tags of the API pages as written,
// so the handler's output gets the tables written out as markdown.
export const prerender = true;
const twins = agentMarkdown();
export const entries = twins.entries;
export const GET: RequestHandler = ({ params }) => withApiTables(twins.GET({ params }), reference);
