import type { DirectorSessionSlot } from "../directorSessionsSync";

export const DND_MIME_SLOT_ID = "application/x-orchestra-director-session-slot";
export const DND_MIME_SCENE_REF =
  "application/x-orchestra-director-session-scene-ref";
export const LEGACY_DND_MIME_STEP_REF =
  "application/x-orchestra-director-session-step-ref";

export type DragSceneRefPayload = {
  kind: "sceneRef";
  projectSlug: string;
  sceneId: number;
  durationMin?: number;
};

export function parseDragSceneRef(dt: DataTransfer): DragSceneRefPayload | null {
  const raw =
    dt.getData(DND_MIME_SCENE_REF) || dt.getData(LEGACY_DND_MIME_STEP_REF);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DragSceneRefPayload & { kind?: string }> | null;
    if (!v || (v.kind !== "sceneRef" && v.kind !== "stepRef")) return null;
    const projectSlug = String(v.projectSlug ?? "").trim();
    const sceneId = Number(v.sceneId);
    const durationMin =
      v.durationMin == null
        ? undefined
        : Math.max(1, Math.floor(Number(v.durationMin)));
    if (!projectSlug) return null;
    if (!Number.isFinite(sceneId) || sceneId <= 0) return null;
    return { kind: "sceneRef", projectSlug, sceneId, durationMin };
  } catch {
    return null;
  }
}

export function parseDragSlotId(dt: DataTransfer): string | null {
  const id = String(
    dt.getData(DND_MIME_SLOT_ID) || dt.getData("text/plain") || "",
  ).trim();
  return id || null;
}

export function guessDurationMin(payload: DragSceneRefPayload): number {
  const d = Number(payload.durationMin);
  if (Number.isFinite(d) && d > 0) return Math.max(1, Math.floor(d));
  return 30;
}

export function packSlotsSequentialInOrder(
  slots: DirectorSessionSlot[],
): DirectorSessionSlot[] {
  const list = [...(slots ?? [])];
  let offset = 0;
  return list.map((s) => {
    const dur = Math.max(1, Math.floor(Number(s.durationMin) || 1));
    const item = { ...s, offsetMin: offset, durationMin: dur };
    offset += dur;
    return item;
  });
}
