import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  globalIgnores([
    ".output/**",
    ".vercel/**",
    ".nitro/**",
    ".tanstack/**",
    "coverage/**",
    "src/generated/**",
    "src/routeTree.gen.ts",
    // Agent worktrees (local only, git-excluded) contain full checkouts and build output.
    ".claude/**",
  ]),
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
]);
