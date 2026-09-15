import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { editorLivePreviewField } from "obsidian";

// Syntax nodes (code, math, front matter, comments) that are never highlighted.
const SKIPPED_NODE = /code|math|frontmatter|comment/i;

export function isInSkippedNode(state: EditorState, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
    if (SKIPPED_NODE.test(node.type.name)) return true;
  }
  return false;
}

export function isLivePreview(state: EditorState): boolean {
  return state.field(editorLivePreviewField, false) ?? false;
}

export function selectionTouches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}
