import { syncPush } from "./api/entity-sync";
import type { SyncChange } from "./api/types/sync";
import { mapTheaterSpotlightToSync } from "../features/theater/model/theater-light-fader-bindings";
import { ensureProject } from "./api/projects";
import { getDesktopApi } from "../shared/platform/desktop-api";
import { createId } from "../shared/utils/createId";
import type { TheaterSpotlight } from "../shared/types/script";

export type FlushDesktopOutboxResult = {
  hadOutbox: boolean;
  outboxItems: number;
  pushedChanges: number;
  ackedOutboxItems: number;
};

type OutboxPayload =
  | {
      kind: "sceneDelta";
      projectSlug: string;
      sceneName: string;
      sceneTitle?: string;
      rawJsonDelta: any;
    }
  | {
      kind: "sceneUpsert" | "stepUpsert";
      projectSlug: string;
      sceneName: string;
      scene?: any;
      step?: any;
      order: number;
    }
  | {
      kind: "sceneDelete" | "stepDelete";
      projectSlug: string;
      sceneName: string;
      scriptSceneId: number;
    };

function outboxSceneRecord(payload: { scene?: any; step?: any }): any {
  return payload.scene ?? payload.step;
}

function mergeSceneDelta(target: any, delta: any) {
  if (!delta || typeof delta !== "object") return;
  for (const [k, v] of Object.entries(delta)) {
    target[k] = v;
  }
}

export async function flushDesktopOutbox(
  accessToken: string,
  projectSlug: string,
): Promise<FlushDesktopOutboxResult> {
  const api = getDesktopApi();
  if (!api?.outboxList || !api?.outboxAck) {
    return { hadOutbox: false, outboxItems: 0, pushedChanges: 0, ackedOutboxItems: 0 };
  }

  const res = await api.outboxList(projectSlug, 400);
  if (!res?.ok || !Array.isArray(res.items) || res.items.length === 0) {
    return { hadOutbox: false, outboxItems: 0, pushedChanges: 0, ackedOutboxItems: 0 };
  }

  // Avoid calling /projects on every keystroke autosave.
  // We can derive scene IDs using cached projectId (it is stable per slug).
  let projectId: string | null =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  if (!projectId) {
    const project = await ensureProject(accessToken, projectSlug, `Проект ${projectSlug}`);
    projectId = project.id;
    if (typeof window !== "undefined") {
      localStorage.setItem(`projectId:${projectSlug}`, projectId);
    }
  }

  const nowIso = new Date().toISOString();
  const sceneDeltaBySceneId = new Map<
    string,
    { name: string; delta: any; outboxIds: string[] }
  >();
  const sceneUpserts: Array<{
    outboxId: string;
    playbookId: string;
    scene: any;
    order: number;
  }> = [];
  const sceneDeletes: Array<{ outboxId: string; playbookId: string; scriptSceneId: number }> = [];

  for (const item of res.items) {
    const outboxId = String(item?.id ?? "");
    const payload = item?.payload as OutboxPayload;
    if (!outboxId || !payload?.kind) continue;
    if (payload.projectSlug !== projectSlug) continue;

    if (payload.kind === "sceneDelta") {
      const sceneId = `${projectId}:${payload.sceneName}`;
      const existing = sceneDeltaBySceneId.get(sceneId) ?? {
        name: payload.sceneTitle || `Сцена ${payload.sceneName}`,
        delta: {},
        outboxIds: [],
      };
      mergeSceneDelta(existing.delta, payload.rawJsonDelta);
      if (payload.sceneTitle) existing.name = payload.sceneTitle;
      existing.outboxIds.push(outboxId);
      sceneDeltaBySceneId.set(sceneId, existing);
      continue;
    }

    if (payload.kind === "sceneDelete" || payload.kind === "stepDelete") {
      const playbookId = `${projectId}:${payload.sceneName}`;
      sceneDeletes.push({ outboxId, playbookId, scriptSceneId: payload.scriptSceneId });
      continue;
    }

    if (payload.kind === "sceneUpsert" || payload.kind === "stepUpsert") {
      const playbookId = `${projectId}:${payload.sceneName}`;
      sceneUpserts.push({
        outboxId,
        playbookId,
        scene: outboxSceneRecord(payload),
        order: payload.order,
      });
    }
  }

  const changes: SyncChange[] = [];

  for (const [sceneId, pack] of sceneDeltaBySceneId.entries()) {
    const scenePayload: any = {
      id: sceneId,
      projectId,
      name: pack.name,
      updatedAt: nowIso,
    };
    const d = pack.delta ?? {};
    if (d.sceneRoles) scenePayload.sceneRoles = d.sceneRoles;
    if (d.lightFaders) scenePayload.lightFaders = d.lightFaders;
    if (d.lightPrograms) scenePayload.lightPrograms = d.lightPrograms;
    if (d.lightChannelRoles) scenePayload.lightChannelRoles = d.lightChannelRoles;

    changes.push({
      id: createId(),
      entityType: "Playbook",
      entityId: sceneId,
      operation: "update",
      payload: scenePayload,
      createdAt: nowIso,
    });

    // Normalize delta keys into dedicated sync entities (rawJson is not sent/stored anymore).
    if (Array.isArray(d.playlist)) {
      for (const it of d.playlist) {
        const sourceId = typeof it?.id === "number" ? it.id : null;
        if (sourceId == null) continue;
        changes.push({
          id: createId(),
          entityType: "PlaylistItem",
          entityId: `${sceneId}:playlist:${sourceId}`,
          operation: "update",
          payload: {
            sceneId,
            sourceId,
            order: typeof it?.order === "number" ? it.order : 0,
            title: String(it?.title ?? `Track ${sourceId}`),
            file: String(it?.file ?? ""),
            fadeMs: typeof it?.fadeMs === "number" ? it.fadeMs : 0,
            loop: Boolean(it?.loop),
            remoteUrl: it?.remoteUrl ?? null,
            remoteKey: it?.remoteKey ?? null,
          },
          createdAt: nowIso,
        });
      }
    }

    if (Array.isArray(d.sounds)) {
      for (const it of d.sounds) {
        const sourceId = typeof it?.id === "number" ? it.id : null;
        if (sourceId == null) continue;
        changes.push({
          id: createId(),
          entityType: "Sound",
          entityId: `${sceneId}:sound:${sourceId}`,
          operation: "update",
          payload: {
            sceneId,
            sourceId,
            title: String(it?.title ?? `Sound ${sourceId}`),
            file: String(it?.file ?? ""),
            icon: it?.icon ?? null,
            volume: typeof it?.volume === "number" ? it.volume : 1,
            fadeMs: typeof it?.fadeMs === "number" ? it.fadeMs : 0,
            loop: Boolean(it?.loop),
            remoteUrl: it?.remoteUrl ?? null,
            remoteKey: it?.remoteKey ?? null,
            iconRemoteUrl: it?.iconRemoteUrl ?? null,
            iconRemoteKey: it?.iconRemoteKey ?? null,
          },
          createdAt: nowIso,
        });
      }
    }

    if (Array.isArray(d.lightChannels)) {
      d.lightChannels.forEach((raw: any, index: number) => {
        changes.push({
          id: createId(),
          entityType: "GlobalLightChannel",
          entityId: `${sceneId}:lightChannel:${index}`,
          operation: "update",
          payload: { sceneId, index, raw: String(raw ?? "") },
          createdAt: nowIso,
        });
      });
    }

    if (d.theaterLayout && typeof d.theaterLayout === "object") {
      changes.push({
        id: createId(),
        entityType: "TheaterLayout",
        entityId: `${sceneId}:theaterLayout`,
        operation: "update",
        payload: { sceneId, ...(d.theaterLayout as any) },
        createdAt: nowIso,
      });
    }
  }

  for (const del of sceneDeletes) {
    const sceneIdNum = Number(del.scriptSceneId);
    if (!Number.isFinite(sceneIdNum)) continue;
    const scriptSceneId = Math.trunc(sceneIdNum);
    changes.push({
      id: createId(),
      entityType: "Scene",
      entityId: `${del.playbookId}:${scriptSceneId}`,
      operation: "delete",
      payload: { id: `${del.playbookId}:${scriptSceneId}`, updatedAt: nowIso },
      createdAt: nowIso,
    });
  }

  for (const up of sceneUpserts) {
    const sceneIdNum = Number((up.scene as { id?: unknown } | null | undefined)?.id);
    if (!Number.isFinite(sceneIdNum)) continue;
    const sourceSceneId = Math.trunc(sceneIdNum);
    const sceneEntityKey = `${up.playbookId}:${sourceSceneId}`;
    const scene = up.scene;
    changes.push({
      id: createId(),
      entityType: "Scene",
      entityId: sceneEntityKey,
      operation: "update",
      payload: {
        id: sceneEntityKey,
        playbookId: up.playbookId,
        sourceId: sourceSceneId,
        title: String(scene?.title ?? "").trim() || `Сцена ${sourceSceneId}`,
        markdown: typeof scene?.markdown === "string" ? scene.markdown : "",
        playMarkdown:
          typeof scene?.playMarkdown === "string" ? scene.playMarkdown : null,
        explicationMarkdown:
          typeof scene?.explicationMarkdown === "string"
            ? scene.explicationMarkdown
            : null,
        durationMin:
          typeof scene?.durationMin === "number" ? scene.durationMin : null,
        kanbanStatus:
          typeof scene?.kanbanStatus === "string" ? scene.kanbanStatus : null,
        kanbanOrder:
          typeof scene?.kanbanOrder === "number" ? scene.kanbanOrder : null,
        order: up.order,
        requisites: Array.isArray(scene?.requisites) ? scene.requisites : [],
        lightPlot: Array.isArray(scene?.lightPlot) ? scene.lightPlot : [],
        lightCues: Array.isArray(scene?.lightCues) ? scene.lightCues : [],
        lightKadrs: scene?.lightKadrs ?? null,
        theaterModels: Array.isArray(scene?.theaterModels) ? scene.theaterModels : [],
        theaterSpotlights: Array.isArray(scene?.theaterSpotlights)
          ? scene.theaterSpotlights.map((sp: TheaterSpotlight) =>
              mapTheaterSpotlightToSync(sp),
            )
          : [],
        updatedAt: nowIso,
      },
      createdAt: nowIso,
    });
  }

  if (changes.length === 0) {
    return {
      hadOutbox: true,
      outboxItems: res.items.length,
      pushedChanges: 0,
      ackedOutboxItems: 0,
    };
  }

  await syncPush(accessToken, changes);

  // Ack only after successful push
  const ackIds = Array.from(
    new Set([
      ...Array.from(sceneDeltaBySceneId.values()).flatMap((x) => x.outboxIds),
      ...sceneUpserts.map((x) => x.outboxId),
      ...sceneDeletes.map((x) => x.outboxId),
    ]),
  );
  await api.outboxAck(ackIds);

  return {
    hadOutbox: true,
    outboxItems: res.items.length,
    pushedChanges: changes.length,
    ackedOutboxItems: ackIds.length,
  };
}

