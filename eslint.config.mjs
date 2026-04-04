/**
 * Корневой ESLint — для legacy CI:
 *   ./node_modules/.bin/eslint "apps/api/{src,apps,libs,test}/**/*.ts"
 * Нужны `eslint` и `@repo/eslint-config` в корневом package.json + `pnpm install`.
 */
import { nestJsConfig } from "@repo/eslint-config/nest-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(root, "apps/api");

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      ".next/**",
      "apps/web/**",
      "packages/**",
      "scripts/**",
      ".github/**",
      "apps/api/test/**",
    ],
  },
  ...nestJsConfig.map((block) => {
    const parserOptions = block.languageOptions && block.languageOptions.parserOptions;
    if (!parserOptions || !parserOptions.project) {
      return block;
    }
    return {
      ...block,
      files: [
        "apps/api/src/**/*.ts",
        "apps/api/apps/**/*.ts",
        "apps/api/libs/**/*.ts",
      ],
      languageOptions: {
        ...block.languageOptions,
        parserOptions: {
          ...parserOptions,
          project: path.join(apiRoot, "tsconfig.json"),
          tsconfigRootDir: apiRoot,
        },
      },
    };
  }),
];
