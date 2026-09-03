import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

// TypeScript files are deliberately not linted here.
//
// typescript-eslint (8.69.0, latest) declares `typescript >=4.8.4 <6.1.0` and
// throws "does not support TS 7.0" on import. ESLint's own parser cannot read
// TypeScript at all, so there is no TS linting to be had until it catches up.
// Strict `pnpm typecheck` covers type errors in the meantime.
//
// To re-enable once typescript-eslint supports TS 7:
//   pnpm add -D typescript-eslint
//   import tseslint from "typescript-eslint";
//   ...then add `tseslint.configs.recommended` below and "ts" to `files`.
export default defineConfig([
  { ignores: ["dist/**", "node_modules/**", ".serverless/**"] },
  {
    files: ["**/*.{js,mjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    // This is a Node service, not a browser app.
    languageOptions: { globals: globals.node },
  },
]);
