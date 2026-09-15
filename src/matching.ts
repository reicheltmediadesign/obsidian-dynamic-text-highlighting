import type { Highlighter } from "./settings/model";

export interface CompiledHighlighter {
  highlighter: Highlighter;
  regex: RegExp;
  /** Classes for a match: base, style, contrast and the user's CSS class. */
  classes: string[];
}

export interface GroupRange {
  name: string;
  from: number;
  to: number;
}

export interface TextMatch {
  from: number;
  to: number;
  /** Visible part of the match; differs from from/to when only the first capture group is shown. */
  showFrom: number;
  showTo: number;
  groups: GroupRange[];
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns an error message if the query is not a valid regular expression. */
export function regexError(query: string): string | null {
  try {
    new RegExp(query);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Picks dark or light text for a hex background color. */
export function contrastClass(hexColor: string): string {
  const value = Number.parseInt(hexColor.slice(1), 16);
  if (Number.isNaN(value)) return "dth-text-dark";
  const channel = (shift: number): number => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.3 ? "dth-text-dark" : "dth-text-light";
}

export function compileHighlighter(highlighter: Highlighter): CompiledHighlighter | null {
  if (!highlighter.enabled || highlighter.query === "") return null;

  const flags = "g" + (highlighter.caseSensitive ? "" : "i") + (highlighter.regex ? "d" : "");
  const source = highlighter.regex ? highlighter.query : escapeRegExp(highlighter.query);
  let regex: RegExp;
  try {
    regex = new RegExp(source, flags);
  } catch {
    return null;
  }

  const classes = ["dth-match", `dth-style-${highlighter.style}`, contrastClass(highlighter.color)];
  if (highlighter.cssClass !== "") classes.push(highlighter.cssClass);
  return { highlighter, regex, classes };
}

const GROUP_CLASS = /^[_a-zA-Z][_a-zA-Z0-9-]*$/;

export function findMatches(compiled: CompiledHighlighter, text: string): TextMatch[] {
  const { highlighter, regex } = compiled;
  const matches: TextMatch[] = [];
  regex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++;
      continue;
    }

    const from = match.index;
    const to = from + match[0].length;
    let showFrom = from;
    let showTo = to;

    const firstGroup = match.indices?.[1];
    if (highlighter.captureGroupOnly && firstGroup && firstGroup[1] > firstGroup[0]) {
      [showFrom, showTo] = firstGroup;
    }

    const groups: GroupRange[] = [];
    const namedGroups = match.indices?.groups;
    if (highlighter.groupClasses && namedGroups) {
      for (const [name, range] of Object.entries(namedGroups)) {
        if (range && range[1] > range[0] && GROUP_CLASS.test(name)) {
          groups.push({ name, from: range[0], to: range[1] });
        }
      }
    }

    matches.push({ from, to, showFrom, showTo, groups });
  }
  return matches;
}

/** True if [from, to) overlaps any of the given ranges. */
export function overlapsAny(ranges: readonly { from: number; to: number }[], from: number, to: number): boolean {
  return ranges.some((range) => range.from < to && range.to > from);
}
