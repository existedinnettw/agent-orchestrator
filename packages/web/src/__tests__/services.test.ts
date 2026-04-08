import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadConfig,
  mockRegister,
  mockCreateSessionManager,
  mockRegistry,
  tmuxPlugin,
  claudePlugin,
  codexPlugin,
  opencodePlugin,
  worktreePlugin,
  scmPlugin,
  trackerGithubPlugin,
  trackerLinearPlugin,
} = vi.hoisted(() => {
  const mockLoadConfig = vi.fn();
  const mockRegister = vi.fn();
  const mockCreateSessionManager = vi.fn();
  const mockRegistry = {
    register: mockRegister,
    get: vi.fn(),
    list: vi.fn(),
    loadBuiltins: vi.fn(),
    loadFromConfig: vi.fn(),
  };

  return {
    mockLoadConfig,
    mockRegister,
    mockCreateSessionManager,
    mockRegistry,
    tmuxPlugin: { manifest: { name: "tmux" } },
    claudePlugin: { manifest: { name: "claude-code" } },
    codexPlugin: { manifest: { name: "codex" } },
    opencodePlugin: { manifest: { name: "opencode" } },
    worktreePlugin: { manifest: { name: "worktree" } },
    scmPlugin: { manifest: { name: "github" } },
    trackerGithubPlugin: { manifest: { name: "github" } },
    trackerLinearPlugin: { manifest: { name: "linear" } },
  };
});

vi.mock("@aoagents/ao-core", () => ({
  loadConfig: mockLoadConfig,
  createPluginRegistry: () => mockRegistry,
  createSessionManager: mockCreateSessionManager,
  createLifecycleManager: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    getStates: vi.fn(),
    check: vi.fn(),
  }),
  decompose: vi.fn(),
  getLeaves: vi.fn(),
  getSiblings: vi.fn(),
  formatPlanTree: vi.fn(),
  DEFAULT_DECOMPOSER_CONFIG: {},
  TERMINAL_STATUSES: new Set(["merged", "killed"]) as ReadonlySet<string>,
}));

vi.mock("@composio/ao-plugin-runtime-tmux", () => ({ default: tmuxPlugin }));
vi.mock("@composio/ao-plugin-agent-claude-code", () => ({ default: claudePlugin }));
vi.mock("@composio/ao-plugin-agent-codex", () => ({ default: codexPlugin }));
vi.mock("@composio/ao-plugin-agent-opencode", () => ({ default: opencodePlugin }));
vi.mock("@composio/ao-plugin-workspace-worktree", () => ({ default: worktreePlugin }));
vi.mock("@composio/ao-plugin-scm-github", () => ({ default: scmPlugin }));
vi.mock("@composio/ao-plugin-tracker-github", () => ({ default: trackerGithubPlugin }));
vi.mock("@composio/ao-plugin-tracker-linear", () => ({ default: trackerLinearPlugin }));

describe("services", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRegister.mockClear();
    mockCreateSessionManager.mockReset();
    mockLoadConfig.mockReset();
    mockLoadConfig.mockReturnValue({
      configPath: "/tmp/agent-orchestrator.yaml",
      port: 3000,
      readyThresholdMs: 300_000,
      defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
      projects: {},
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
    });
    mockCreateSessionManager.mockReturnValue({
      list: vi.fn().mockResolvedValue([]),
    });
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoAutoImplementCatchUp?: unknown })
      ._aoAutoImplementCatchUp;
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoAutoImplementCatchUp?: unknown })
      ._aoAutoImplementCatchUp;
  });

  it("registers the OpenCode agent plugin with web services", async () => {
    const { getServices } = await import("../lib/services");

    await getServices();

    expect(mockRegister).toHaveBeenCalledWith(opencodePlugin);
  });

  it("caches initialized services across repeated calls", async () => {
    const { getServices } = await import("../lib/services");

    const first = await getServices();
    const second = await getServices();

    expect(first).toBe(second);
    expect(mockCreateSessionManager).toHaveBeenCalledTimes(1);
  });
});

describe("pollBacklog", () => {
  const mockUpdateIssue = vi.fn();
  const mockListIssues = vi.fn();
  const mockSpawn = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    mockRegister.mockClear();
    mockCreateSessionManager.mockReset();
    mockLoadConfig.mockReset();
    mockUpdateIssue.mockClear();
    mockListIssues.mockClear();
    mockSpawn.mockClear();

    mockLoadConfig.mockReturnValue({
      configPath: "/tmp/agent-orchestrator.yaml",
      port: 3000,
      readyThresholdMs: 300_000,
      defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
      projects: {
        "test-project": {
          path: "/tmp/test-project",
          tracker: { plugin: "github" },
          backlog: { label: "agent:backlog", maxConcurrent: 5 },
        },
      },
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
    });

    mockCreateSessionManager.mockReturnValue({
      spawn: mockSpawn,
      list: vi.fn().mockResolvedValue([]),
    });

    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoAutoImplementCatchUp?: unknown })
      ._aoAutoImplementCatchUp;
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoAutoImplementCatchUp?: unknown })
      ._aoAutoImplementCatchUp;
  });

  it("removes agent:backlog label when claiming an issue", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "123",
        title: "Test Issue",
        description: "Test description",
        url: "https://github.com/test/test/issues/123",
        state: "open",
        labels: ["agent:backlog"],
      },
    ]);

    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
          updateIssue: mockUpdateIssue,
        };
      }
      if (slot === "agent") {
        return { name: "claude-code" };
      }
      if (slot === "runtime") {
        return { name: "tmux" };
      }
      if (slot === "workspace") {
        return { name: "worktree" };
      }
      return null;
    });

    const { pollBacklog } = await import("../lib/services");
    await pollBacklog();

    expect(mockUpdateIssue).toHaveBeenCalledWith(
      "123",
      {
        labels: ["agent:in-progress"],
        removeLabels: ["agent:backlog"],
        comment: "Claimed by agent orchestrator — session spawned.",
      },
      expect.objectContaining({ tracker: { plugin: "github" } }),
    );
  });
});

describe("auto-implement catch-up", () => {
  const mockListIssues = vi.fn();
  const mockSpawn = vi.fn();
  const mockListSessions = vi.fn();
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.resetModules();
    mockRegister.mockClear();
    mockCreateSessionManager.mockReset();
    mockLoadConfig.mockReset();
    mockListIssues.mockReset();
    mockSpawn.mockReset();
    mockListSessions.mockReset();
    consoleErrorSpy.mockClear();

    mockLoadConfig.mockReturnValue({
      configPath: "/tmp/agent-orchestrator.yaml",
      port: 3000,
      readyThresholdMs: 300_000,
      defaults: { runtime: "tmux", agent: "codex", workspace: "worktree", notifiers: [] },
      projects: {
        "test-project": {
          path: "/tmp/test-project",
          tracker: { plugin: "github" },
          scm: {
            plugin: "github",
            webhook: {
              autoImplement: {
                enabled: true,
                label: "ao",
                catchUp: {
                  enabled: true,
                },
              },
            },
          },
        },
      },
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
    });

    mockCreateSessionManager.mockReturnValue({
      spawn: mockSpawn,
      list: mockListSessions,
    });

    mockRegistry.get.mockReset();
    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
        };
      }
      if (slot === "agent") return { name: "codex" };
      if (slot === "runtime") return { name: "tmux" };
      if (slot === "workspace") return { name: "worktree" };
      return null;
    });

    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoAutoImplementCatchUp?: unknown })
      ._aoAutoImplementCatchUp;
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoAutoImplementCatchUp?: unknown })
      ._aoAutoImplementCatchUp;
  });

  it("spawns open issues already labeled for auto-implement during startup", async () => {
    mockListSessions.mockResolvedValue([]);
    mockListIssues.mockResolvedValue([
      {
        id: "42",
        title: "Fix webhook drift",
        description: "sync",
        url: "https://github.com/acme/test/issues/42",
        state: "open",
        labels: ["ao"],
      },
    ]);

    const { getServices } = await import("../lib/services");
    await getServices();

    expect(mockListIssues).toHaveBeenCalledWith(
      { state: "open", labels: ["ao"], limit: 100 },
      expect.objectContaining({ tracker: { plugin: "github" } }),
    );
    expect(mockSpawn).toHaveBeenCalledWith({ projectId: "test-project", issueId: "42" });
  });

  it("skips catch-up spawn when a live session already exists", async () => {
    mockListSessions.mockResolvedValue([
      { projectId: "test-project", issueId: "42", status: "working" },
    ]);
    mockListIssues.mockResolvedValue([
      {
        id: "42",
        title: "Fix webhook drift",
        description: "sync",
        url: "https://github.com/acme/test/issues/42",
        state: "open",
        labels: ["ao"],
      },
    ]);

    const { getServices } = await import("../lib/services");
    await getServices();

    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("skips catch-up when the tracker cannot list issues", async () => {
    mockListSessions.mockResolvedValue([]);
    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") return { name: "github" };
      if (slot === "agent") return { name: "codex" };
      if (slot === "runtime") return { name: "tmux" };
      if (slot === "workspace") return { name: "worktree" };
      return null;
    });

    const { getServices } = await import("../lib/services");
    await getServices();

    expect(mockListIssues).not.toHaveBeenCalled();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("logs and continues when one catch-up spawn fails", async () => {
    mockListSessions.mockResolvedValue([]);
    mockListIssues.mockResolvedValue([
      {
        id: "42",
        title: "First",
        description: "first",
        url: "https://github.com/acme/test/issues/42",
        state: "open",
        labels: ["ao"],
      },
      {
        id: "43",
        title: "Second",
        description: "second",
        url: "https://github.com/acme/test/issues/43",
        state: "open",
        labels: ["ao"],
      },
    ]);
    mockSpawn.mockRejectedValueOnce(new Error("spawn failed")).mockResolvedValueOnce(undefined);

    const { getServices } = await import("../lib/services");
    await getServices();

    expect(mockSpawn).toHaveBeenNthCalledWith(1, { projectId: "test-project", issueId: "42" });
    expect(mockSpawn).toHaveBeenNthCalledWith(2, { projectId: "test-project", issueId: "43" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[auto-implement] Failed to spawn catch-up issue 42:",
      expect.any(Error),
    );
  });

  it("runs catch-up only once across repeated getServices calls", async () => {
    mockListSessions.mockResolvedValue([]);
    mockListIssues.mockResolvedValue([
      {
        id: "42",
        title: "Fix webhook drift",
        description: "sync",
        url: "https://github.com/acme/test/issues/42",
        state: "open",
        labels: ["ao"],
      },
    ]);

    const { getServices } = await import("../lib/services");
    await getServices();
    await getServices();

    expect(mockListIssues).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });
});
