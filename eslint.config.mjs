import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config (ESLint 9 + eslint-config-next 16). Replaces the legacy
 * `.eslintrc.json` + `next lint`, which crashed with "Converting circular
 * structure to JSON" because Next 15's `next lint` can't consume
 * eslint-config-next@16's flat-config plugin objects.
 */
const eslintConfig = [
  {
    // Build output, generated files, and tooling/config that `next lint` never
    // scanned (CommonJS configs, scripts) — keep lint scoped to app source.
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
      "*.config.{js,cjs,mjs,ts}",
      "nodemon.js",
      "scripts/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
