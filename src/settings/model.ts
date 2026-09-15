export const HIGHLIGHT_STYLES = ["highlight", "badge", "text", "underline", "none"] as const;

export type HighlightStyle = (typeof HIGHLIGHT_STYLES)[number];

export interface Highlighter {
  id: string;
  name: string;
  enabled: boolean;
  /** Plain search text, or a regular expression when `regex` is set. */
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  style: HighlightStyle;
  /** Hex color, e.g. #ffd43b. */
  color: string;
  /** Extra CSS class for styling with snippets. */
  cssClass: string;
  /** Regex only: show the first capture group and hide the rest of the match. */
  captureGroupOnly: boolean;
  /** Regex only: add the names of named capture groups as CSS classes (editor). */
  groupClasses: boolean;
  /** Editor only: add a class to the whole line. */
  highlightLine: boolean;
  /** Apply in reading view and PDF export. */
  readingView: boolean;
}

export interface PluginSettings {
  highlightersEnabled: boolean;
  highlighters: Highlighter[];
  selectionEnabled: boolean;
  wordAroundCursor: boolean;
  selectedText: boolean;
  minSelectionLength: number;
  maxMatches: number;
  delay: number;
  ignoredWords: string;
}

const DEFAULT_IGNORED_WORDS =
  "a, an, and, are, as, at, be, but, by, for, from, has, have, if, in, into, is, it, its, of, on, or, so, than, that, the, their, then, there, these, they, this, to, was, were, will, with";

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const CSS_CLASS = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

export function isValidCssClass(value: string): boolean {
  return CSS_CLASS.test(value);
}

export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createHighlighter(overrides: Partial<Highlighter> = {}): Highlighter {
  return {
    id: createId(),
    name: "",
    enabled: true,
    query: "",
    regex: false,
    caseSensitive: false,
    style: "highlight",
    color: "#ffd43b",
    cssClass: "",
    captureGroupOnly: false,
    groupClasses: false,
    highlightLine: false,
    readingView: false,
    ...overrides,
  };
}

function placeholderBadge(word: string, color: string): Highlighter {
  return createHighlighter({
    name: `${word} badge`,
    query: `=(${word})=`,
    regex: true,
    caseSensitive: true,
    style: "badge",
    color,
    captureGroupOnly: true,
    readingView: true,
  });
}

export function defaultSettings(): PluginSettings {
  return {
    highlightersEnabled: true,
    highlighters: [
      placeholderBadge("TODO", "#ffd43b"),
      placeholderBadge("FIXME", "#ff922b"),
      placeholderBadge("DONE", "#51cf66"),
    ],
    selectionEnabled: true,
    wordAroundCursor: true,
    selectedText: true,
    minSelectionLength: 3,
    maxMatches: 100,
    delay: 200,
    ignoredWords: DEFAULT_IGNORED_WORDS,
  };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick<T>(value: unknown, fallback: T, check: (v: unknown) => boolean): T {
  return check(value) ? (value as T) : fallback;
}

const isBoolean = (v: unknown): boolean => typeof v === "boolean";
const isString = (v: unknown): boolean => typeof v === "string";
const isCount = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function isHighlightStyle(value: unknown): value is HighlightStyle {
  return typeof value === "string" && (HIGHLIGHT_STYLES as readonly string[]).includes(value);
}

/** Builds a valid highlighter from untrusted data, or returns null if it has no query. */
export function parseHighlighter(data: unknown): Highlighter | null {
  if (!isRecord(data) || typeof data.query !== "string") return null;
  const base = createHighlighter();
  const cssClass = typeof data.cssClass === "string" && isValidCssClass(data.cssClass) ? data.cssClass : "";
  return {
    id: pick(data.id, base.id, (v) => typeof v === "string" && v !== ""),
    name: pick(data.name, base.name, isString),
    enabled: pick(data.enabled, base.enabled, isBoolean),
    query: data.query,
    regex: pick(data.regex, base.regex, isBoolean),
    caseSensitive: pick(data.caseSensitive, base.caseSensitive, isBoolean),
    style: isHighlightStyle(data.style) ? data.style : base.style,
    color: pick(data.color, base.color, (v) => typeof v === "string" && HEX_COLOR.test(v)),
    cssClass,
    captureGroupOnly: pick(data.captureGroupOnly, base.captureGroupOnly, isBoolean),
    groupClasses: pick(data.groupClasses, base.groupClasses, isBoolean),
    highlightLine: pick(data.highlightLine, base.highlightLine, isBoolean),
    readingView: pick(data.readingView, base.readingView, isBoolean),
  };
}

/** Gives every highlighter a unique id, keeping existing ids where possible. */
export function ensureUniqueIds(highlighters: Highlighter[], taken = new Set<string>()): Highlighter[] {
  return highlighters.map((highlighter) => {
    let id = highlighter.id;
    while (taken.has(id)) id = createId();
    taken.add(id);
    return id === highlighter.id ? highlighter : { ...highlighter, id };
  });
}

export function parseSettings(data: unknown): PluginSettings {
  const defaults = defaultSettings();
  if (!isRecord(data)) return defaults;

  const highlighters = Array.isArray(data.highlighters)
    ? ensureUniqueIds(data.highlighters.map(parseHighlighter).filter((h): h is Highlighter => h !== null))
    : defaults.highlighters;

  return {
    highlightersEnabled: pick(data.highlightersEnabled, defaults.highlightersEnabled, isBoolean),
    highlighters,
    selectionEnabled: pick(data.selectionEnabled, defaults.selectionEnabled, isBoolean),
    wordAroundCursor: pick(data.wordAroundCursor, defaults.wordAroundCursor, isBoolean),
    selectedText: pick(data.selectedText, defaults.selectedText, isBoolean),
    minSelectionLength: pick(data.minSelectionLength, defaults.minSelectionLength, isCount),
    maxMatches: pick(data.maxMatches, defaults.maxMatches, isCount),
    delay: pick(data.delay, defaults.delay, isCount),
    ignoredWords: pick(data.ignoredWords, defaults.ignoredWords, isString),
  };
}
