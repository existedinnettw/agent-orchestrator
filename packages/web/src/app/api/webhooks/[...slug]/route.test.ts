import { describe, expect, it, vi, beforeEach } from "vitest";

const mockVerifyWebhook = vi.fn();
const mockParseWebhook = vi.fn();
const mockListSessions = vi.fn();
const mockLifecycleCheck = vi.fn();
const mockGetServices = vi.fn();
const mockPollBacklog = vi.fn();
const mockStartBacklogPoller = vi.fn();
const mockFindWebhookProjects = vi.fn();
const mockEventMatchesProject = vi.fn();
const mockFindAffectedSessions = vi.fn();
const mockBuildWebhookRequest = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: mockGetServices,
  pollBacklog: mockPollBacklog,
  startBacklogPoller: mockStartBacklogPoller,
}));

vi.mock("@/lib/scm-webhooks", () => ({
  buildWebhookRequest: mockBuildWebhookRequest,
  eventMatchesProject: mockEventMatchesProject,
  findAffectedSessions: mockFindAffectedSessions,
  findWebhookProjects: mockFindWebhookProjects,
}));

describe("POST /api/webhooks/[...slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          "test-project": {
            repo: "acme/repo",
            path: "/tmp/repo",
            scm: { plugin: "github" },
          },
        },
      },
      registry: {},
      sessionManager: { list: mockListSessions },
      lifecycleManager: { check: mockLifecycleCheck },
    });

    mockVerifyWebhook.mockResolvedValue({ ok: true, eventType: "issues" });
    mockParseWebhook.mockResolvedValue({
      provider: "github",
      kind: "unknown",
      action: "labeled",
      rawEventType: "issues",
      repository: { owner: "acme", name: "repo" },
      data: {},
    });

    mockFindWebhookProjects.mockReturnValue([
      {
        projectId: "test-project",
        project: {
          repo: "acme/repo",
          path: "/tmp/repo",
          scm: { plugin: "github" },
        },
        scm: {
          verifyWebhook: mockVerifyWebhook,
          parseWebhook: mockParseWebhook,
        },
      },
    ]);

    mockBuildWebhookRequest.mockReturnValue({});
    mockEventMatchesProject.mockReturnValue(true);
    mockFindAffectedSessions.mockReturnValue([]);
    mockListSessions.mockResolvedValue([]);
    mockPollBacklog.mockResolvedValue(undefined);
  });

  it("runs backlog polling for verified issue webhooks even without affected sessions", async () => {
    const { POST } = await import("./route");

    const request = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
      },
      body: JSON.stringify({
        action: "labeled",
        repository: { owner: { login: "acme" }, name: "repo" },
        issue: { number: 123 },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    expect(mockStartBacklogPoller).toHaveBeenCalledTimes(1);
    expect(mockPollBacklog).toHaveBeenCalledTimes(1);
    expect(mockLifecycleCheck).not.toHaveBeenCalled();
  });
});
