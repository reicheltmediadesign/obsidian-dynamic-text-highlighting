import { type App, Notice, PluginSettingTab, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import type DynamicTextHighlightingPlugin from "../main";
import { regexError } from "../matching";
import { ImportModal } from "./import-modal";
import { createHighlighter, type Highlighter, isValidCssClass, type PluginSettings } from "./model";

const STYLE_OPTIONS: Record<Highlighter["style"], string> = {
  highlight: "Background",
  badge: "Badge",
  text: "Text color",
  underline: "Wavy underline",
  none: "None, CSS class only",
};

const HIGHLIGHTER_KEY = /^highlighter:([^:]+):(\w+)$/;

type GlobalKey = Exclude<keyof PluginSettings, "highlighters">;

function highlighterKey(highlighter: Highlighter, field: keyof Highlighter): string {
  return `highlighter:${highlighter.id}:${field}`;
}

export class DynamicTextHighlightingSettingTab extends PluginSettingTab {
  private readonly plugin: DynamicTextHighlightingPlugin;

  constructor(app: App, plugin: DynamicTextHighlightingPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const { settings } = this.plugin;
    const selectionVisible = (): boolean => settings.selectionEnabled;

    return [
      {
        type: "group",
        heading: "Highlighters",
        items: [
          {
            name: "Enable highlighters",
            desc: "Highlight text matching the highlighters below.",
            control: { type: "toggle", key: "highlightersEnabled" },
          },
        ],
      },
      {
        type: "list",
        emptyState: "No highlighters yet.",
        addItem: {
          name: "Add highlighter",
          action: () => {
            settings.highlighters.push(createHighlighter({ name: "New highlighter" }));
            void this.saveAndUpdate();
          },
        },
        onDelete: (index) => {
          settings.highlighters.splice(index, 1);
          void this.saveAndUpdate();
        },
        onReorder: (oldIndex, newIndex) => {
          const [moved] = settings.highlighters.splice(oldIndex, 1);
          if (moved) settings.highlighters.splice(newIndex, 0, moved);
          void this.saveAndUpdate();
        },
        items: settings.highlighters.map((highlighter) => this.highlighterPage(highlighter)),
      },
      {
        type: "group",
        heading: "Selection",
        items: [
          {
            name: "Enable selection highlighting",
            desc: "Highlight other occurrences of the word under the cursor or of the selected text in the editor.",
            control: { type: "toggle", key: "selectionEnabled" },
          },
          {
            name: "Word under cursor",
            desc: "Highlight all occurrences of the word under the cursor.",
            visible: selectionVisible,
            control: { type: "toggle", key: "wordAroundCursor" },
          },
          {
            name: "Selected text",
            desc: "Highlight all occurrences of the selected text.",
            visible: selectionVisible,
            control: { type: "toggle", key: "selectedText" },
          },
          {
            name: "Minimum length",
            desc: "Words and selections shorter than this are not highlighted.",
            visible: selectionVisible,
            control: { type: "number", key: "minSelectionLength", min: 1, max: 100, step: 1, defaultValue: 3 },
          },
          {
            name: "Maximum matches",
            desc: "Stop highlighting after this many matches.",
            visible: selectionVisible,
            control: { type: "number", key: "maxMatches", min: 1, max: 10000, step: 1, defaultValue: 100 },
          },
          {
            name: "Delay",
            desc: "Milliseconds to wait after moving the cursor before matches appear.",
            visible: selectionVisible,
            control: { type: "number", key: "delay", min: 0, max: 5000, step: 50, defaultValue: 200 },
          },
          {
            name: "Ignored words",
            desc: "Comma separated list of words that are never highlighted.",
            visible: selectionVisible,
            control: { type: "textarea", key: "ignoredWords", rows: 4 },
          },
        ],
      },
      {
        type: "group",
        heading: "Import and export",
        items: [
          {
            name: "Export highlighters",
            desc: "Copy all highlighters as JSON to the clipboard.",
            action: () => void this.exportHighlighters(),
          },
          {
            name: "Import highlighters",
            desc: "Add highlighters from JSON exported by this plugin or by Dynamic Highlights.",
            action: () => new ImportModal(this.app, (json) => this.plugin.importHighlighters(json)).open(),
          },
          {
            name: "Import from Dynamic Highlights",
            desc: "Add the highlighters of the installed Dynamic Highlights plugin. Its custom CSS is saved as a CSS snippet.",
            visible: () => this.plugin.dynamicHighlightsDataPath !== null,
            action: () => void this.plugin.importFromDynamicHighlights().then(() => this.update()),
          },
        ],
      },
    ];
  }

  private highlighterPage(highlighter: Highlighter): SettingGroupItem {
    const isRegex = (): boolean => highlighter.regex;
    const key = (field: keyof Highlighter): string => highlighterKey(highlighter, field);

    return {
      type: "page",
      name: highlighter.name || "Unnamed highlighter",
      desc: highlighter.query,
      items: [
        {
          name: "Name",
          control: { type: "text", key: key("name"), placeholder: "Highlighter name" },
        },
        {
          name: "Enabled",
          control: { type: "toggle", key: key("enabled") },
        },
        {
          name: "Search",
          desc: "Text to find, or a regular expression.",
          control: {
            type: "text",
            key: key("query"),
            placeholder: "Search text",
            validate: (value) => {
              if (!highlighter.regex) return;
              const error = regexError(value);
              return error === null ? undefined : `Invalid regular expression: ${error}`;
            },
          },
        },
        {
          name: "Regular expression",
          control: { type: "toggle", key: key("regex") },
        },
        {
          name: "Case sensitive",
          control: { type: "toggle", key: key("caseSensitive") },
        },
        {
          name: "Style",
          control: { type: "dropdown", key: key("style"), options: STYLE_OPTIONS },
        },
        {
          name: "Color",
          control: { type: "color", key: key("color") },
        },
        {
          name: "Show only the first capture group",
          desc: "Hide the rest of the match, for example the equals signs in =(TODO)=. In live preview the full match appears while the cursor is inside it.",
          visible: isRegex,
          control: { type: "toggle", key: key("captureGroupOnly") },
        },
        {
          name: "Named groups as CSS classes",
          desc: "In the editor, the text of a named capture group such as (?<label>...) gets the group name as CSS class.",
          visible: isRegex,
          control: { type: "toggle", key: key("groupClasses") },
        },
        {
          name: "Highlight whole line",
          desc: "Tint the entire line of a match in the editor.",
          control: { type: "toggle", key: key("highlightLine") },
        },
        {
          name: "Reading view and PDF export",
          desc: "Also highlight matches in reading view and exported PDFs. Matches spanning formatted text are not found there.",
          control: { type: "toggle", key: key("readingView") },
        },
        {
          name: "CSS class",
          desc: "Extra class on every match, for styling this highlighter with a CSS snippet.",
          control: {
            type: "text",
            key: key("cssClass"),
            placeholder: "my-highlight",
            validate: (value) =>
              value === "" || isValidCssClass(value) ? undefined : "Use letters, digits, hyphens and underscores.",
          },
        },
      ],
    };
  }

  getControlValue(key: string): unknown {
    const match = HIGHLIGHTER_KEY.exec(key);
    if (match) {
      const highlighter = this.findHighlighter(match[1]);
      return highlighter?.[match[2] as keyof Highlighter];
    }
    return this.plugin.settings[key as GlobalKey];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const match = HIGHLIGHTER_KEY.exec(key);
    if (match) {
      const highlighter = this.findHighlighter(match[1]);
      const field = match[2] as keyof Highlighter;
      if (!highlighter || field === "id" || !(field in highlighter)) return;
      if (typeof value !== typeof highlighter[field]) return;
      (highlighter as unknown as Record<string, unknown>)[field] = value;
      await this.plugin.saveSettings();
      if (field === "regex") this.refreshDomState();
      return;
    }

    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (!(key in settings) || key === "highlighters" || typeof value !== typeof settings[key]) return;
    settings[key] = value;
    await this.plugin.saveSettings();
    if (key === "selectionEnabled") this.refreshDomState();
  }

  private findHighlighter(id: string | undefined): Highlighter | undefined {
    return this.plugin.settings.highlighters.find((highlighter) => highlighter.id === id);
  }

  private async saveAndUpdate(): Promise<void> {
    await this.plugin.saveSettings();
    this.update();
  }

  private async exportHighlighters(): Promise<void> {
    const json = JSON.stringify(this.plugin.settings.highlighters, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      new Notice("Highlighters copied to the clipboard.");
    } catch {
      new Notice("Could not access the clipboard.");
    }
  }
}
