import { type CompiledHighlighter, findMatches, overlapsAny } from "./matching";

// Code, math and front matter stay untouched.
const SKIPPED_TAGS = new Set(["CODE", "PRE", "KBD", "SCRIPT", "STYLE", "TEXTAREA", "MJX-CONTAINER"]);
const SKIPPED_CLASSES = ["dth-match", "frontmatter", "math"];

interface AcceptedMatch {
  from: number;
  to: number;
  showFrom: number;
  showTo: number;
  compiled: CompiledHighlighter;
}

function isSkipped(node: Node, root: HTMLElement): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (SKIPPED_TAGS.has(el.tagName)) return true;
    if (SKIPPED_CLASSES.some((cls) => el.hasClass(cls))) return true;
    if (el === root) break;
  }
  return false;
}

function collectMatches(text: string, highlighters: readonly CompiledHighlighter[]): AcceptedMatch[] {
  const accepted: AcceptedMatch[] = [];
  // Earlier highlighters win when matches overlap.
  for (const compiled of highlighters) {
    for (const match of findMatches(compiled, text)) {
      if (!overlapsAny(accepted, match.from, match.to)) accepted.push({ ...match, compiled });
    }
  }
  return accepted.sort((a, b) => a.from - b.from);
}

/**
 * Wraps matches in rendered Markdown. Runs in reading view, in rendered blocks
 * of live preview (tables, callouts) and in PDF export.
 */
export function highlightRenderedMarkdown(root: HTMLElement, highlighters: readonly CompiledHighlighter[]): void {
  if (highlighters.length === 0) return;

  const walker = root.doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.nodeValue && !isSkipped(node, root)) textNodes.push(node as Text);
  }

  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    const matches = collectMatches(text, highlighters);
    if (matches.length === 0) continue;

    const fragment = createFragment();
    let last = 0;
    for (const match of matches) {
      if (match.from > last) fragment.appendText(text.slice(last, match.from));
      const span = fragment.createSpan({
        cls: match.compiled.classes,
        text: text.slice(match.showFrom, match.showTo),
      });
      span.setCssProps({ "--dth-color": match.compiled.highlighter.color });
      last = match.to;
    }
    if (last < text.length) fragment.appendText(text.slice(last));
    node.replaceWith(fragment);
  }
}
