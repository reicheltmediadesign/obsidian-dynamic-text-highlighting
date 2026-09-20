# Contributing

Thanks for taking the time to improve Dynamic Text Highlighting. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an issue at https://github.com/reicheltmediadesign/obsidian-dynamic-text-highlighting/issues and include:

- Your Obsidian version, operating system and the plugin version
- The steps that reproduce the problem
- What you expected to happen and what happened instead
- An export of the highlighters involved, and whether it happens in the editor, the reading view or the PDF export

Before reporting, please check whether the problem still occurs with all other plugins disabled and the default theme enabled. That tells us quickly whether it is a conflict with another plugin or snippet.

## Suggesting a feature

Open an issue and describe the problem you want to solve, not only the solution you have in mind. Knowing the use case often leads to a simpler feature that fits more people.

## Pull requests

For anything larger than a fix, please open an issue first so we can agree on the approach before you spend time on it.

1. Fork the repository and create a branch off `main`.
2. Install the dependencies with `npm install` (Node.js 22 or newer).
3. Make your change. `npm run dev` rebuilds on every save; copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/dynamic-text-highlighting/` to test it in Obsidian.
4. Make sure `npm run build` and `npm run lint` both pass without errors.
5. Open a pull request that explains what changed and why.

`main.js` is build output and is not checked in.

## Code style

- TypeScript in strict mode, no `any`. Data of unknown origin goes through the `parse*` helpers in `src/settings/model.ts`, so invalid values fall back to the defaults.
- Keep settings backwards compatible: `parseSettings` keeps reading old keys and maps them to the new ones.
- Register everything with `registerEvent`, `register` or `addCommand` so that `onunload` cleans up after itself, and remove classes and custom properties the plugin has set.
- Style through CSS classes with the `dth-` prefix and custom properties in `styles.css`, not through inline styles. Reuse Obsidian's own variables (`--size-4-2`, `--text-muted`, …) where possible.
- Keep the class and custom property list in the header comment of `styles.css` and in the "Styling with CSS snippets" section of the README up to date.
- User interface text is English in sentence case.
- Report errors with a `Notice` instead of swallowing them.
- No network requests and no telemetry, ever.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
