import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@aoagents/ao-core/utils", replacement: resolve(__dirname, "../../core/src/utils.ts") },
      {
        find: "@aoagents/ao-core/scm-webhook-utils",
        replacement: resolve(__dirname, "../../core/src/scm-webhook-utils.ts"),
      },
      {
        find: "@aoagents/ao-plugin-scm-gitlab/glab-utils",
        replacement: resolve(__dirname, "../scm-gitlab/src/glab-utils.ts"),
      },
      { find: "@aoagents/ao-core", replacement: resolve(__dirname, "../../core/src/index.ts") },
    ],
  },
});
