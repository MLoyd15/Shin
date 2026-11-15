import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "coverage/**", "supabase/.temp/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@folioagent/api/jobs/service-role-client",
              message: "The service-role client may only be imported from apps/api/src/jobs/.",
            },
          ],
          patterns: [
            {
              group: ["**/jobs/service-role-client", "**/jobs/service-role-client.*"],
              message: "The service-role client may only be imported from apps/api/src/jobs/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/jobs/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
);
