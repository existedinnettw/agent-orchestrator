import { NextResponse } from "next/server";
import { TERMINAL_STATUSES, type Tracker } from "@composio/ao-core";
import { getServices } from "@/lib/services";
import {
  buildWebhookRequest,
  eventMatchesProject,
  findAffectedSessions,
  findWebhookProjects,
} from "@/lib/scm-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const services = await getServices();
    const path = new URL(request.url).pathname;
    const candidates = findWebhookProjects(services.config, services.registry, path);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No SCM webhook configured for this path" },
        { status: 404 },
      );
    }

    const rawContentLength = request.headers.get("content-length");
    const contentLength = rawContentLength ? Number(rawContentLength) : NaN;
    const candidateMaxBodyBytes = candidates.map(
      (candidate) => candidate.project.scm?.webhook?.maxBodyBytes,
    );
    const allCandidatesBounded = candidateMaxBodyBytes.every((value) => typeof value === "number");
    const maxBodyBytes = allCandidatesBounded
      ? Math.max(...(candidateMaxBodyBytes as number[]))
      : undefined;
    if (
      maxBodyBytes !== undefined &&
      Number.isFinite(contentLength) &&
      contentLength > maxBodyBytes
    ) {
      return NextResponse.json(
        { error: "Webhook payload exceeds configured maxBodyBytes" },
        { status: 413 },
      );
    }

    const rawBody = new Uint8Array(await request.arrayBuffer());
    const body = new TextDecoder().decode(rawBody);
    const webhookRequest = buildWebhookRequest(request, body, rawBody);

    const sessions = await services.sessionManager.list();
    const sessionIds = new Set<string>();
    const projectIds = new Set<string>();
    const spawnedIssueIds = new Set<string>();
    const skippedDuplicateIssueIds = new Set<string>();
    const cleanedIssueIds = new Set<string>();
    let verified = false;
    const errors: string[] = [];
    const parseErrors: string[] = [];
    const lifecycleErrors: string[] = [];
    const spawnErrors: string[] = [];
    const cleanupErrors: string[] = [];

    for (const candidate of candidates) {
      const verification = await candidate.scm.verifyWebhook?.(webhookRequest, candidate.project);
      if (!verification?.ok) {
        if (verification?.reason) errors.push(verification.reason);
        continue;
      }
      verified = true;

      let event;
      try {
        event = await candidate.scm.parseWebhook?.(webhookRequest, candidate.project);
      } catch (err) {
        parseErrors.push(err instanceof Error ? err.message : "Invalid webhook payload");
        continue;
      }

      if (!event || !eventMatchesProject(event, candidate.project)) {
        continue;
      }

      projectIds.add(candidate.projectId);

      const autoImplement = candidate.project.scm?.webhook?.autoImplement;
      const autoImplementEnabled = autoImplement?.enabled === true;
      const autoImplementLabel = autoImplement?.label;

      if (
        autoImplementEnabled &&
        event.kind === "issue" &&
        event.action === "labeled" &&
        event.issueNumber !== undefined &&
        event.issueLabel === autoImplementLabel
      ) {
        const issueId = String(event.issueNumber);
        const hasLiveSession = sessions.some(
          (session) =>
            session.projectId === candidate.projectId &&
            session.issueId === issueId &&
            !TERMINAL_STATUSES.has(session.status),
        );

        if (hasLiveSession) {
          skippedDuplicateIssueIds.add(issueId);
        } else {
          try {
            const session = await services.sessionManager.spawn({
              projectId: candidate.projectId,
              issueId,
            });
            sessions.push(session);
            spawnedIssueIds.add(issueId);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to spawn session";
            spawnErrors.push(`issue ${issueId}: ${message}`);
          }
        }
      }

      if (
        autoImplementEnabled &&
        event.kind === "issue" &&
        event.action === "closed" &&
        event.issueNumber !== undefined &&
        autoImplementLabel
      ) {
        const tracker = candidate.project.tracker?.plugin
          ? services.registry.get<Tracker>("tracker", candidate.project.tracker.plugin)
          : null;

        if (!tracker?.updateIssue) {
          cleanupErrors.push(
            `issue ${event.issueNumber}: tracker does not support updateIssue for project ${candidate.projectId}`,
          );
        } else {
          try {
            await tracker.updateIssue(
              String(event.issueNumber),
              { removeLabels: [autoImplementLabel] },
              candidate.project,
            );
            cleanedIssueIds.add(String(event.issueNumber));
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to remove label";
            cleanupErrors.push(`issue ${event.issueNumber}: ${message}`);
          }
        }
      }

      const affectedSessions = findAffectedSessions(sessions, candidate.projectId, event);
      if (affectedSessions.length === 0) {
        continue;
      }

      const lifecycle = services.lifecycleManager;
      for (const session of affectedSessions) {
        sessionIds.add(session.id);
        try {
          await lifecycle.check(session.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Lifecycle check failed";
          lifecycleErrors.push(`session ${session.id}: ${message}`);
        }
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: errors[0] ?? "Webhook verification failed", ok: false },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        projectIds: [...projectIds],
        sessionIds: [...sessionIds],
        matchedSessions: sessionIds.size,
        spawnedIssueIds: [...spawnedIssueIds],
        skippedDuplicateIssueIds: [...skippedDuplicateIssueIds],
        cleanedIssueIds: [...cleanedIssueIds],
        parseErrors,
        lifecycleErrors,
        spawnErrors,
        cleanupErrors,
      },
      { status: 202 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process SCM webhook" },
      { status: 500 },
    );
  }
}
