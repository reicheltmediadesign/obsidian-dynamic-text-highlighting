import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type CompiledHighlighter, findMatches, overlapsAny } from "../matching";
import { isInSkippedNode, isLivePreview, selectionTouches } from "./skip";

const hiddenText = Decoration.replace({});

interface CachedDecorations {
  mark: Decoration;
  line: Decoration;
}

function decorationsFor(compiled: CompiledHighlighter): CachedDecorations {
  const { color, cssClass } = compiled.highlighter;
  const attributes = { style: `--dth-color: ${color}` };
  return {
    mark: Decoration.mark({ class: compiled.classes.join(" "), attributes }),
    line: Decoration.line({ class: cssClass === "" ? "dth-line" : `dth-line ${cssClass}-line`, attributes }),
  };
}

function buildDecorations(
  view: EditorView,
  highlighters: readonly CompiledHighlighter[],
  cache: Map<CompiledHighlighter, CachedDecorations>,
): DecorationSet {
  if (highlighters.length === 0) return Decoration.none;

  const { state } = view;
  const livePreview = isLivePreview(state);
  const ranges: Range<Decoration>[] = [];
  const hiddenMatches: { from: number; to: number }[] = [];
  const decoratedLines = new Set<string>();

  for (const { from, to } of view.visibleRanges) {
    const text = state.doc.sliceString(from, to);

    for (const compiled of highlighters) {
      let decorations = cache.get(compiled);
      if (!decorations) {
        decorations = decorationsFor(compiled);
        cache.set(compiled, decorations);
      }

      for (const match of findMatches(compiled, text)) {
        const start = from + match.from;
        const end = from + match.to;
        if (isInSkippedNode(state, start)) continue;

        if (compiled.highlighter.highlightLine) {
          const lineStart = state.doc.lineAt(start).from;
          const key = `${compiled.highlighter.id}:${lineStart}`;
          if (!decoratedLines.has(key)) {
            decoratedLines.add(key);
            ranges.push(decorations.line.range(lineStart));
          }
        }

        const showStart = from + match.showFrom;
        const showEnd = from + match.showTo;
        const hasHiddenParts = showStart > start || showEnd < end;
        const hide =
          hasHiddenParts &&
          livePreview &&
          !selectionTouches(state, start, end) &&
          !overlapsAny(hiddenMatches, start, end);

        if (hide) {
          // Live preview: hide everything outside the first capture group until the cursor enters the match.
          hiddenMatches.push({ from: start, to: end });
          if (showStart > start) ranges.push(hiddenText.range(start, showStart));
          if (showEnd < end) ranges.push(hiddenText.range(showEnd, end));
          ranges.push(decorations.mark.range(showStart, showEnd));
        } else {
          ranges.push(decorations.mark.range(start, end));
        }

        for (const group of match.groups) {
          ranges.push(Decoration.mark({ class: group.name }).range(from + group.from, from + group.to));
        }
      }
    }
  }
  return Decoration.set(ranges, true);
}

export function createHighlighterExtension(getHighlighters: () => readonly CompiledHighlighter[]): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private readonly cache = new Map<CompiledHighlighter, CachedDecorations>();

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, getHighlighters(), this.cache);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          isLivePreview(update.startState) !== isLivePreview(update.state) ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = buildDecorations(update.view, getHighlighters(), this.cache);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
