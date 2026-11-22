import type { ApiEntry, ApiReference } from "./types.ts";

/**
 * The agent markdown of the API pages. docsmith writes a page's markdown for agents (the `.md` twin of each page, the
 * copy page menu and `llms-full.txt`) from its source, and keeps a component tag it has no rewrite for as written. So
 * the `<ApiTable name="..." />` tags of the API pages are replaced here, from the same extracted data the component
 * renders, and the route handlers pass their output through `withApiTables`.
 */

/** A `<ApiTable name="X" />` tag on a line of its own. Group 1 is the indentation, group 2 or 3 the name. */
const API_TABLE_TAG = /^([ \t]*)<ApiTable\s+name\s*=\s*(?:"([^"]*)"|'([^']*)')\s*\/>[ \t]*$/;

/** The opener of a fenced code block: three or more backticks or tildes. */
const FENCE = /^[ \t]*(`{3,}|~{3,})/;

/** One table cell: on one line, with its pipes escaped. GFM reads `\|` as a pipe inside code spans in tables too. */
function cell(text: string): string {
    return text.replace(/\s+/g, " ").trim().replaceAll("|", "\\|");
}

/** An entry as markdown: its description, its signature in a code block, and a table of its properties, if any. */
export function apiEntryMarkdown(entry: ApiEntry): string {
    const parts = [
        entry.description
            .split(/\n\s*\n/)
            .map((paragraph) => paragraph.trim())
            .join("\n\n"),
        ["```ts", entry.signature, "```"].join("\n"),
    ];
    if (entry.properties.length > 0) {
        const rows = entry.properties.map((property) =>
            [
                `\`${cell(property.name)}${property.optional ? "?" : ""}\``,
                `\`${cell(property.type)}\``,
                property.default === undefined ? "-" : `\`${cell(property.default)}\``,
                cell(property.description),
            ].join(" | "),
        );
        parts.push(
            [
                "| Name | Type | Default | Description |",
                "| --- | --- | --- | --- |",
                ...rows.map((row) => `| ${row} |`),
            ].join("\n"),
        );
    }
    return parts.join("\n\n");
}

/**
 * Replaces every `<ApiTable name="X" />` tag in the prose of a markdown text with the markdown of entry X. Tags in
 * fenced code blocks are sample code, and stay.
 * @throws {Error} on a name the reference does not have, as the component does, so the build fails
 */
export function expandApiTables(markdown: string, reference: ApiReference): string {
    const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
    let fence: string | undefined;
    const lines = markdown.split(/\r?\n/).map((line) => {
        const opener = FENCE.exec(line)?.[1];
        if (fence !== undefined) {
            // a fence closes on the same character, at least as long as its opener, with nothing after it
            if (opener && opener[0] === fence[0] && opener.length >= fence.length && line.trim() === opener) {
                fence = undefined;
            }
            return line;
        }
        if (opener) {
            fence = opener;
            return line;
        }
        const tag = API_TABLE_TAG.exec(line);
        if (!tag) return line;
        const name = tag[2] ?? tag[3];
        const entry = reference[name];
        if (!entry) throw new Error(`Unknown API entry: ${name}`);
        return apiEntryMarkdown(entry)
            .split("\n")
            .map((written) => (written ? tag[1] + written : written))
            .join(eol);
    });
    return lines.join(eol);
}

/** The response with its body passed through `expandApiTables`. A failed response is returned as it is. */
export async function withApiTables(response: Response, reference: ApiReference): Promise<Response> {
    if (!response.ok) return response;
    const body = expandApiTables(await response.text(), reference);
    return new Response(body, { status: response.status, headers: response.headers });
}
