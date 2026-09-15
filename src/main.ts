import type { Extension } from "@codemirror/state";
import { debounce, MarkdownView, normalizePath, Notice, Plugin } from "obsidian";
import { createHighlighterExtension } from "./editor/highlighters";
import { createSelectionExtension, parseIgnoredWords, type SelectionOptions } from "./editor/selection";
import { type CompiledHighlighter, compileHighlighter } from "./matching";
import { highlightRenderedMarkdown } from "./reading-view";
import { parseImport } from "./settings/import";
import { ensureUniqueIds, parseSettings, type PluginSettings } from "./settings/model";
import { DynamicTextHighlightingSettingTab } from "./settings/settings-tab";

const DYNAMIC_HIGHLIGHTS_ID = "obsidian-dynamic-highlights";
const IMPORTED_SNIPPET_NAME = "dynamic-highlights-import";

export default class DynamicTextHighlightingPlugin extends Plugin {
  settings!: PluginSettings;
  /** Path of the Dynamic Highlights configuration, if that plugin is installed. */
  dynamicHighlightsDataPath: string | null = null;

  private editorHighlighters: CompiledHighlighter[] = [];
  private readingViewHighlighters: CompiledHighlighter[] = [];
  private selectionOptions!: SelectionOptions;
  private readonly editorExtensions: Extension[] = [];
  private settingTab!: DynamicTextHighlightingSettingTab;

  private readonly refreshOpenNotes = debounce(
    () => {
      this.app.workspace.updateOptions();
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
      }
    },
    500,
    true,
  );

  async onload(): Promise<void> {
    this.settings = parseSettings(await this.loadData());
    this.applySettings();

    this.registerEditorExtension(this.editorExtensions);
    this.registerMarkdownPostProcessor((element) =>
      highlightRenderedMarkdown(element, this.readingViewHighlighters),
    );

    this.addCommand({
      id: "toggle-highlighters",
      name: "Toggle highlighters",
      callback: () => void this.toggleSetting("highlightersEnabled"),
    });
    this.addCommand({
      id: "toggle-selection-highlighting",
      name: "Toggle selection highlighting",
      callback: () => void this.toggleSetting("selectionEnabled"),
    });

    this.settingTab = new DynamicTextHighlightingSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    this.app.workspace.onLayoutReady(() => void this.detectDynamicHighlights());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.applySettings();
    this.refreshOpenNotes();
  }

  /** Adds highlighters from pasted JSON. Returns true on success. */
  async importHighlighters(json: string): Promise<boolean> {
    try {
      const result = parseImport(json);
      await this.addImportedHighlighters(result.highlighters, result.css);
      return true;
    } catch (error) {
      new Notice(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async importFromDynamicHighlights(): Promise<void> {
    if (this.dynamicHighlightsDataPath === null) return;
    try {
      const result = parseImport(await this.app.vault.adapter.read(this.dynamicHighlightsDataPath));
      await this.addImportedHighlighters(result.highlighters, result.css);
    } catch (error) {
      new Notice(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async addImportedHighlighters(highlighters: PluginSettings["highlighters"], css: string): Promise<void> {
    const taken = new Set(this.settings.highlighters.map((highlighter) => highlighter.id));
    this.settings.highlighters.push(...ensureUniqueIds(highlighters, taken));
    await this.saveSettings();
    this.settingTab.update();

    let message = `Imported ${highlighters.length} highlighters.`;
    if (css !== "") {
      const snippet = await this.writeSnippet(css);
      message += ` Their CSS was saved as snippet "${snippet}". Enable it under Settings, Appearance, CSS snippets.`;
    }
    new Notice(message, 10000);
  }

  /** Saves CSS as a new snippet file and returns the snippet name. */
  private async writeSnippet(css: string): Promise<string> {
    const { adapter, configDir } = this.app.vault;
    const folder = normalizePath(`${configDir}/snippets`);
    if (!(await adapter.exists(folder))) await adapter.mkdir(folder);

    let name = IMPORTED_SNIPPET_NAME;
    for (let i = 2; await adapter.exists(normalizePath(`${folder}/${name}.css`)); i++) {
      name = `${IMPORTED_SNIPPET_NAME}-${i}`;
    }
    const header = "/* Custom CSS imported from Dynamic Highlights by Dynamic Text Highlighting */\n\n";
    await adapter.write(normalizePath(`${folder}/${name}.css`), header + css + "\n");
    return name;
  }

  private async detectDynamicHighlights(): Promise<void> {
    const path = normalizePath(`${this.app.vault.configDir}/plugins/${DYNAMIC_HIGHLIGHTS_ID}/data.json`);
    this.dynamicHighlightsDataPath = (await this.app.vault.adapter.exists(path)) ? path : null;
    if (this.dynamicHighlightsDataPath !== null) this.settingTab.update();
  }

  private async toggleSetting(key: "highlightersEnabled" | "selectionEnabled"): Promise<void> {
    this.settings[key] = !this.settings[key];
    await this.saveSettings();
    const label = key === "highlightersEnabled" ? "Highlighters" : "Selection highlighting";
    new Notice(`${label} ${this.settings[key] ? "on" : "off"}`);
  }

  private applySettings(): void {
    const { settings } = this;
    const compiled = settings.highlightersEnabled
      ? settings.highlighters.map(compileHighlighter).filter((h): h is CompiledHighlighter => h !== null)
      : [];
    this.editorHighlighters = compiled;
    this.readingViewHighlighters = compiled.filter((h) => h.highlighter.readingView);

    this.selectionOptions = {
      wordAroundCursor: settings.wordAroundCursor,
      selectedText: settings.selectedText,
      minSelectionLength: settings.minSelectionLength,
      maxMatches: settings.maxMatches,
      delay: settings.delay,
      ignoredWords: parseIgnoredWords(settings.ignoredWords),
    };

    // The array is registered once; replacing its content and calling
    // workspace.updateOptions() reconfigures all open editors.
    this.editorExtensions.length = 0;
    if (compiled.length > 0) {
      this.editorExtensions.push(createHighlighterExtension(() => this.editorHighlighters));
    }
    if (settings.selectionEnabled && (settings.wordAroundCursor || settings.selectedText)) {
      this.editorExtensions.push(createSelectionExtension(() => this.selectionOptions));
    }
  }
}
