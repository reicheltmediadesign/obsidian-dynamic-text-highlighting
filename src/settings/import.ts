import { createHighlighter, HEX_COLOR, type Highlighter, isValidCssClass, parseHighlighter } from "./model";

export interface ImportResult {
  highlighters: Highlighter[];
  /** Custom CSS found in a Dynamic Highlights configuration. */
  css: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // #rrggbbaa -> #rrggbb, the color picker has no alpha channel
  const hex = /^#[0-9a-f]{8}$/i.test(value) ? value.slice(0, 7) : value;
  return HEX_COLOR.test(hex) ? hex.toLowerCase() : undefined;
}

function isDynamicHighlightsQuery(value: unknown): value is UnknownRecord {
  return isRecord(value) && typeof value.query === "string" && typeof value.class === "string";
}

function convertDynamicHighlightsQueries(queries: UnknownRecord, order: unknown): ImportResult {
  const names = Object.keys(queries);
  const ordered = Array.isArray(order)
    ? [...order.filter((name): name is string => typeof name === "string" && name in queries), ...names]
    : names;

  const highlighters: Highlighter[] = [];
  const cssBlocks: string[] = [];
  for (const name of new Set(ordered)) {
    const query = queries[name];
    if (!isDynamicHighlightsQuery(query)) continue;

    const marks = Array.isArray(query.mark) ? query.mark : ["match"];
    const cssClass = typeof query.class === "string" && isValidCssClass(query.class) ? query.class : "";
    const regex = query.regex === true;

    highlighters.push(
      createHighlighter({
        name,
        query: query.query as string,
        regex,
        caseSensitive: regex,
        color: normalizeColor(query.color) ?? "#ffd43b",
        cssClass,
        style: marks.includes("match") ? "highlight" : "none",
        groupClasses: regex && marks.includes("group"),
        highlightLine: marks.includes("line"),
      }),
    );

    if (typeof query.css === "string" && query.css.trim() !== "") {
      cssBlocks.push(`/* ${name.replace(/\*\//g, "")} */\n${query.css.trim()}`);
    }
  }
  return { highlighters, css: cssBlocks.join("\n\n") };
}

/**
 * Accepts
 * - an array of highlighters exported by this plugin,
 * - the data.json of Dynamic Highlights,
 * - a highlighter export of Dynamic Highlights (object of queries).
 */
export function parseImport(json: string): ImportResult {
  const data: unknown = JSON.parse(json);

  if (Array.isArray(data)) {
    const highlighters = data.map(parseHighlighter).filter((h): h is Highlighter => h !== null);
    if (highlighters.length === 0) throw new Error("No highlighters found.");
    return { highlighters, css: "" };
  }

  if (isRecord(data)) {
    if (Array.isArray(data.highlighters)) return parseImport(JSON.stringify(data.highlighters));

    const staticHighlighter = data.staticHighlighter;
    if (isRecord(staticHighlighter) && isRecord(staticHighlighter.queries)) {
      return convertDynamicHighlightsQueries(staticHighlighter.queries, staticHighlighter.queryOrder);
    }

    if (Object.values(data).some(isDynamicHighlightsQuery)) {
      return convertDynamicHighlightsQueries(data, undefined);
    }
  }

  throw new Error("Unknown format.");
}
