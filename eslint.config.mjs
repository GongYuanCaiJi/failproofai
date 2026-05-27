import nextConfig from "eslint-config-next/core-web-vitals";
import tsParser from "@typescript-eslint/parser";

const config = [
  // Skip generated bundles and design-asset reference files. assets/audit
  // is the brand team's reference HTML/JSX kit, not source code we ship.
  { ignores: ["dist/", "assets/"] },
  ...nextConfig,
  { settings: { react: { version: "19" } } },
  {
    files: ["**/*.{js,jsx,mjs,mts,cts}"],
    languageOptions: { parser: tsParser },
  },
];

export default config;

