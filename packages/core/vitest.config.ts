import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@aoagents/ao-core/scm-webhook-utils",
        replacement: resolve(__dirname, "src/scm-webhook-utils.ts"),
      },
      {
        find: "@aoagents/ao-core",
        replacement: resolve(__dirname, "src/index.ts"),
      },
      // Integration tests import real plugins. These aliases resolve
      // package names to source files so we don't need circular devDeps
      // (plugins depend on core, core can't depend on plugins).
      {
        find: "@aoagents/ao-plugin-tracker-github",
        replacement: resolve(__dirname, "../plugins/tracker-github/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-scm-github",
        replacement: resolve(__dirname, "../plugins/scm-github/src/index.ts"),
      },
    ],
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts", "src/recovery/index.ts"],
    },
  },
});
