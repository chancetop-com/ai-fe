import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import onlyWarn from "eslint-plugin-only-warn"
import tseslint from "typescript-eslint"
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
]
