import { ensureProject, syncPush, type SyncChange } from "./api";
import { getDesktopApi } from "../shared/platform/desktop-api";
import { createId } from "../shared/utils/createId";

type OutboxPayload =
  | {
      kind: "sceneDelta";
      projectSlug: string;
      sceneName: string;
      sceneTitle?: string;
      rawJsonDelta: any;
    }
  | {
      kind: "stepUpsert";
      projectSlug: string;
      sceneName: string;
      step: any;
      order: number;
    }
  | { kind: "stepDelete"; projectSlug: string; sceneName: string; stepId: number };

function mergeSceneDelta(target: any, delta: any) {
  if (!delta || typeof delta !== "object") return;
  for (const [k, v] of Object.entries(delta)) {
    target[k] = v;
  }
}

export async function flushDesktopOutbox(accessToken: string, projectSlug: string) {
  const api = getDesktopApi();
  if (!api?.outboxList || !api?.outboxAck) return;

  const res = await api.outboxList(projectSlug, 400);
  if (!res?.ok || !Array.isArray(res.items) || res.items.length === 0) return;

  const project = await ensureProject(accessToken, projectSlug, `Проект ${projectSlug}`);
  const projectId = project.id;

  const nowIso = new Date().toISOString();
  const sceneDeltaBySceneId = new Map<string, { name: string; rawJson: any; outboxIds: string[] }>();
  const stepUpserts: Array<{
    outboxId: string;
    sceneId: string;
    step: any;
    order: number;
  }> = [];
  const stepDeletes: Array<{ outboxId: string; sceneId: string; stepId: number }> = [];

  for (const item of res.items) {
    const outboxId = String(item?.id ?? "");
    const payload = item?.payload as OutboxPayload;
    if (!outboxId || !payload?.kind) continue;
    if (payload.projectSlug !== projectSlug) continue;

    if (payload.kind === "sceneDelta") {
      const sceneId = `${projectId}:${payload.sceneName}`;
      const existing = sceneDeltaBySceneId.get(sceneId) ?? {
        name: payload.sceneTitle || `Сцена ${payload.sceneName}`,
        rawJson: {},
        outboxIds: [],
      };
      mergeSceneDelta(existing.rawJson, payload.rawJsonDelta);
      if (payload.sceneTitle) existing.name = payload.sceneTitle;
      existing.outboxIds.push(outboxId);
      sceneDeltaBySceneId.set(sceneId, existing);
      continue;
    }

    if (payload.kind === "stepDelete") {
      const sceneId = `${projectId}:${payload.sceneName}`;
      stepDeletes.push({ outboxId, sceneId, stepId: payload.stepId });
      continue;
    }

    if (payload.kind === "stepUpsert") {
      const sceneId = `${projectId}:${payload.sceneName}`;
      stepUpserts.push({
        outboxId,
        sceneId,
        step: payload.step,
        order: payload.order,
      });
    }
  }

  const changes: SyncChange[] = [];

  for (const [sceneId, pack] of sceneDeltaBySceneId.entries()) {
    changes.push({
      id: createId(),
      entityType: "Scene",
      entityId: sceneId,
      operation: "update",
      payload: {
        id: sceneId,
        projectId,
        name: pack.name,
        rawJson: pack.rawJson,
        updatedAt: nowIso,
      },
      createdAt: nowIso,
    });
  }

  for (const del of stepDeletes) {
    changes.push({
      id: createId(),
      entityType: "Step",
      entityId: `${del.sceneId}:${del.stepId}`,
      operation: "delete",
      payload: { id: `${del.sceneId}:${del.stepId}`, updatedAt: nowIso },
      createdAt: nowIso,
    });
  }

  for (const up of stepUpserts) {
    const stepId = typeof up.step?.id === "number" ? up.step.id : null;
    if (stepId == null) continue;
    const stepKey = `${up.sceneId}:${stepId}`;
    changes.push({
      id: createId(),
      entityType: "Step",
      entityId: stepKey,
      operation: "update",
      payload: {
        id: stepKey,
        sceneId: up.sceneId,
        sourceId: stepId,
        title: String(up.step?.title ?? "").trim() || `Step ${stepId}`,
        markdown: typeof up.step?.markdown === "string" ? up.step.markdown : "",
        playMarkdown:
          typeof up.step?.playMarkdown === "string" ? up.step.playMarkdown : null,
        durationMin:
          typeof up.step?.durationMin === "number" ? up.step.durationMin : null,
        kanbanStatus:
          typeof up.step?.kanbanStatus === "string" ? up.step.kanbanStatus : null,
        kanbanOrder:
          typeof up.step?.kanbanOrder === "number" ? up.step.kanbanOrder : null,
        cast: up.step?.cast ?? null,
        order: up.order,
        requisites: Array.isArray(up.step?.requisites) ? up.step.requisites : [],
        lightPlot: Array.isArray(up.step?.lightPlot) ? up.step.lightPlot : [],
        theaterModels: Array.isArray(up.step?.theaterModels) ? up.step.theaterModels : [],
        theaterSpotlights: Array.isArray(up.step?.theaterSpotlights)
          ? up.step.theaterSpotlights
          : [],
        updatedAt: nowIso,
      },
      createdAt: nowIso,
    });
  }

  if (changes.length === 0) return;

  await syncPush(accessToken, changes);

  // Ack only after successful push
  const ackIds = Array.from(
    new Set([
      ...Array.from(sceneDeltaBySceneId.values()).flatMap((x) => x.outboxIds),
      ...stepUpserts.map((x) => x.outboxId),
      ...stepDeletes.map((x) => x.outboxId),
    ]),
  );
  await api.outboxAck(ackIds);
}

