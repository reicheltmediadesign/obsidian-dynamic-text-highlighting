import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  globalIgnores(["node_modules", "main.js"]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs", "version-bump.mjs"],
        },
      },
    },
  },
  {
    // Build scripts run in Node.js, not inside Obsidian.
    files: ["*.mjs"],
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
    },
  },
]);
