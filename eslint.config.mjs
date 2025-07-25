import typescriptEslintEslintPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/node_modules",
      "**/scripts",
      "**/test",
      "**/dist",
      "**/coverage",
    ],
  },
  ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslintEslintPlugin,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "module",

      parserOptions: {
        project: "tsconfig.json",
        tsconfigRootDir: ".",
      },
    },

    rules: {
      // Must be removed
      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      "@typescript-eslint/no-deprecated": "warn",

      "no-console": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "_ignore",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
