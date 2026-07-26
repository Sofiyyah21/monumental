import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./apps/api/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
  },

  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      parserOptions: {
        project: "./apps/web/tsconfig.app.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
  },
  {
    files: ["apps/web/vite.config.ts"],
    languageOptions: {
      parserOptions: {
        project: "./apps/web/tsconfig.node.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
