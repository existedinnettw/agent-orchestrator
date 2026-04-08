import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@aoagents/ao-core/utils", replacement: resolve(__dirname, "../core/src/utils.ts") },
      {
        find: "@aoagents/ao-core/scm-webhook-utils",
        replacement: resolve(__dirname, "../core/src/scm-webhook-utils.ts"),
      },
      { find: "@aoagents/ao-core", replacement: resolve(__dirname, "../core/src/index.ts") },
      {
        find: "@aoagents/ao-plugin-agent-aider",
        replacement: resolve(__dirname, "../plugins/agent-aider/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-agent-claude-code",
        replacement: resolve(__dirname, "../plugins/agent-claude-code/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-agent-codex",
        replacement: resolve(__dirname, "../plugins/agent-codex/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-agent-opencode",
        replacement: resolve(__dirname, "../plugins/agent-opencode/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-notifier-composio",
        replacement: resolve(__dirname, "../plugins/notifier-composio/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-notifier-desktop",
        replacement: resolve(__dirname, "../plugins/notifier-desktop/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-notifier-openclaw",
        replacement: resolve(__dirname, "../plugins/notifier-openclaw/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-notifier-slack",
        replacement: resolve(__dirname, "../plugins/notifier-slack/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-notifier-webhook",
        replacement: resolve(__dirname, "../plugins/notifier-webhook/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-runtime-process",
        replacement: resolve(__dirname, "../plugins/runtime-process/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-runtime-tmux",
        replacement: resolve(__dirname, "../plugins/runtime-tmux/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-terminal-iterm2",
        replacement: resolve(__dirname, "../plugins/terminal-iterm2/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-terminal-web",
        replacement: resolve(__dirname, "../plugins/terminal-web/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-tracker-linear",
        replacement: resolve(__dirname, "../plugins/tracker-linear/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-workspace-clone",
        replacement: resolve(__dirname, "../plugins/workspace-clone/src/index.ts"),
      },
      {
        find: "@aoagents/ao-plugin-workspace-worktree",
        replacement: resolve(__dirname, "../plugins/workspace-worktree/src/index.ts"),
      },
    ],
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: "forks",
    include: ["src/**/*.integration.test.ts"],
  },
});
