import { CharCategory, type EditorState, type Extension, type Range, StateEffect } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { escapeRegExp } from "../matching";
import { isInSkippedNode } from "./skip";

export interface SelectionOptions {
  wordAroundCursor: boolean;
  selectedText: boolean;
  minSelectionLength: number;
  maxMatches: number;
  delay: number;
  ignoredWords: ReadonlySet<string>;
}

const refreshMatches = StateEffect.define<null>();
const matchDecoration = Decoration.mark({ class: "dth-selection-match" });
const mainMatchDecoration = Decoration.mark({ class: "dth-selection-match dth-selection-match-main" });

export function parseIgnoredWords(value: string): Set<string> {
  return new Set(
    value
      .split(/[,\n]/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word !== ""),
  );
}

function isWordBoundary(state: EditorState, pos: number, side: -1 | 1): boolean {
  const char = side < 0 ? state.sliceDoc(pos - 1, pos) : state.sliceDoc(pos, pos + 1);
  return char === "" || state.charCategorizer(pos)(char) !== CharCategory.Word;
}

function buildDecorations(view: EditorView, options: SelectionOptions): DecorationSet {
  const { state } = view;
  const selection = state.selection.main;

  let query: string;
  let wholeWord: boolean;
  if (selection.empty) {
    if (!options.wordAroundCursor) return Decoration.none;
    const word = state.wordAt(selection.head);
    if (!word) return Decoration.none;
    query = state.sliceDoc(word.from, word.to);
    wholeWord = true;
  } else {
    if (!options.selectedText) return Decoration.none;
    if (state.doc.lineAt(selection.from).number !== state.doc.lineAt(selection.to).number) return Decoration.none;
    query = state.sliceDoc(selection.from, selection.to);
    if (query.trim() === "") return Decoration.none;
    wholeWord = false;
  }

  if (query.length < options.minSelectionLength) return Decoration.none;
  if (options.ignoredWords.has(query.trim().toLowerCase())) return Decoration.none;

  const regex = new RegExp(escapeRegExp(query), "gi");
  const ranges: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = state.doc.sliceString(from, to);
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (wholeWord && !(isWordBoundary(state, start, -1) && isWordBoundary(state, end, 1))) continue;
      if (isInSkippedNode(state, start)) continue;

      const isMain = start <= selection.to && end >= selection.from;
      ranges.push((isMain ? mainMatchDecoration : matchDecoration).range(start, end));
      if (ranges.length >= options.maxMatches) return Decoration.set(ranges);
    }
  }

  // A single match is the selection itself; nothing else to point out.
  return ranges.length > 1 ? Decoration.set(ranges) : Decoration.none;
}

export function createSelectionExtension(getOptions: () => SelectionOptions): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private timer: number | null = null;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, getOptions());
      }

      update(update: ViewUpdate): void {
        const options = getOptions();
        const refreshRequested = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshMatches)));

        if (refreshRequested) {
          this.decorations = buildDecorations(update.view, options);
          return;
        }
        if (!update.selectionSet && !update.docChanged && !update.viewportChanged) return;

        if (options.delay <= 0) {
          this.decorations = buildDecorations(update.view, options);
          return;
        }

        this.decorations = update.selectionSet ? Decoration.none : this.decorations.map(update.changes);
        this.schedule(update.view, options.delay);
      }

      destroy(): void {
        this.cancel();
      }

      private schedule(view: EditorView, delay: number): void {
        this.cancel();
        this.timer = window.setTimeout(() => {
          this.timer = null;
          view.dispatch({ effects: refreshMatches.of(null) });
        }, delay);
      }

      private cancel(): void {
        if (this.timer !== null) {
          window.clearTimeout(this.timer);
          this.timer = null;
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
