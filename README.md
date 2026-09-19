# Dynamic Text Highlighting

Highlight text in your notes with your own search terms and regular expressions, turn placeholders such as `=TODO=` into badges, and see every occurrence of the word under the cursor.

Highlighters work in the editor, and optionally in reading view and exported PDFs.

## Features

- **Highlighters**: define search terms or regular expressions and choose how matches look: background, badge, text color, wavy underline or only a CSS class.
- **Badges for placeholders**: show only the first capture group of a match, e.g. `=(TODO)=` renders as a `TODO` badge without the equals signs. In live preview the equals signs reappear while the cursor is inside.
- **Reading view and PDF export**: highlighters can also apply to rendered notes, so badges and highlights end up in printed documents.
- **Selection highlighting**: highlight all occurrences of the word under the cursor or of the selected text, with a minimum length, a match limit, a delay and a list of ignored words.
- **Import and export**: share highlighters as JSON. Configurations of the Dynamic Highlights plugin can be imported, including its custom CSS.
- **Commands**: toggle highlighters and selection highlighting from the command palette or a hotkey.

Code blocks, inline code, math and front matter are never highlighted.

## Highlighters

Open **Settings → Dynamic Text Highlighting** and add a highlighter with the plus button. Each highlighter has these options:

| Option                            | Description                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Name                              | Shown in the list of highlighters.                                                                       |
| Enabled                           | Turn a single highlighter on or off.                                                                     |
| Search                            | Text to find, or a regular expression.                                                                   |
| Regular expression                | Treat the search as a JavaScript regular expression.                                                     |
| Case sensitive                    | Match upper and lower case exactly.                                                                      |
| Style                             | Background, badge, text color, wavy underline, or none (CSS class only).                                 |
| Color                             | Color of the highlight. Text on backgrounds and badges switches between dark and light automatically.   |
| Show only the first capture group | Regular expressions only. Hide the rest of the match.                                                    |
| Named groups as CSS classes       | Regular expressions only. In the editor, a named group `(?<name>...)` gets its name as CSS class.        |
| Highlight whole line              | Tint the entire line of a match in the editor.                                                           |
| Reading view and PDF export       | Also highlight in rendered notes.                                                                        |
| CSS class                         | Extra class on every match, for styling with a CSS snippet.                                              |

Drag highlighters to reorder them. When matches overlap in reading view, the highlighter higher in the list wins.

### Default highlighters

New installations start with three badge highlighters as an example:

| Name        | Search      | Style | Color  |
| ----------- | ----------- | ----- | ------ |
| TODO badge  | `=(TODO)=`  | Badge | Yellow |
| FIXME badge | `=(FIXME)=` | Badge | Orange |
| DONE badge  | `=(DONE)=`  | Badge | Green  |

```markdown
Chapter 3 =TODO= add sources
The formula is not correct yet =FIXME=
```

### Examples

| Purpose                             | Search                         | Settings                                         |
| ----------------------------------- | ------------------------------ | ------------------------------------------------ |
| Priority badges                     | `=(P[1-3])=`                   | Regex, badge, first capture group, reading view  |
| Filler words                        | `\b(basically\|actually\|very)\b` | Regex, wavy underline                          |
| Repeated spaces                     | ` {2,}`                        | Regex, background                                |
| Dates in ISO format                 | `\d{4}-\d{2}-\d{2}`            | Regex, text color                                |
| A name you want to spot             | `Jane Doe`                     | Background                                       |

Regular expressions with lookbehind, such as `(?<=x)`, do not work on iOS versions older than 16.4.

## Styling with CSS snippets

Every match has the classes `dth-match` and `dth-style-<style>` and, if set, the highlighter's CSS class. Set `--dth-background` and `--dth-foreground` to override the colors, for example with a gradient badge:

```css
.priority-high {
  --dth-background: linear-gradient(135deg, #ff2d87 0%, #7b2ff7 100%);
  --dth-foreground: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
}
```

With **Highlight whole line**, the line gets `dth-line` and `<css class>-line`. Selection matches use `dth-selection-match` and, for the occurrence at the cursor, `dth-selection-match-main`.

## Migrating from Dynamic Highlights

1. Keep Dynamic Highlights installed and open **Settings → Dynamic Text Highlighting**.
2. Under **Import and export**, select **Import from Dynamic Highlights**. All persistent highlighters are added with their names, search terms, colors and CSS classes.
3. Custom CSS of those highlighters is saved as the CSS snippet `dynamic-highlights-import`. Enable it under **Settings → Appearance → CSS snippets**.
4. Disable Dynamic Highlights to avoid double highlighting.

Selection settings are not imported. Dynamic Highlights applied the highlighter color through generated CSS; the imported highlighters use the style **Background** with the same color instead.

## Limitations

- In reading view and PDF export, a match must lie within one piece of formatted text. A search for `a b` does not match `a **b**`.
- Named groups as CSS classes and whole line highlighting only apply in the editor.

## Privacy

The plugin works entirely offline. It makes no network requests and collects no data. It only reads files inside your vault configuration folder when you import from Dynamic Highlights, and only writes a CSS snippet there during that import.

## Installation

### From the community plugins directory

1. Open **Settings → Community plugins** and turn off restricted mode.
2. Select **Browse**, search for **Dynamic Text Highlighting** and select **Install**.
3. Select **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Copy them into `<your vault>/.obsidian/plugins/dynamic-text-highlighting/`.
3. Reload Obsidian and enable **Dynamic Text Highlighting** under **Settings → Community plugins**.

Requires Obsidian 1.13.0 or later.

## Acknowledgements

Inspired by [Dynamic Highlights](https://github.com/nothingislost/obsidian-dynamic-highlights) by NothingIsLost, which is no longer listed in the community plugins directory. This plugin is a separate implementation and does not contain its code.

## License

[MIT](LICENSE)
