import type { RoleNoteItem, TeamProfile } from "../../../sync/api";

export const ROLE_WORKBOOK_MARKER = "[[ROLE_WORKBOOK_V1]]";
export const ROLE_DIRECTOR_REFS_MARKER = "[[ROLE_DIRECTOR_REFS_V1]]";

export type RoleSceneArc = {
  stepId?: number;
  stepTitle?: string;
  text: string;
};

export type RoleWorkbookDataV1 = {
  v: 1;
  /** Client timestamp to resolve ties between server note times. */
  savedAtIso?: string;
  actorEmail: string;
  biography: string;
  superObjective: string; // сквозное действие
  appearance: string;
  /** New: image refs (remote keys). */
  referenceImages: DirectorReferenceImage[];
  /** Legacy: old link-based references (kept for backward compat). */
  referenceLinksLegacy: string[];
  preparation: string; // заметки "как готовиться"
  sceneArcs: RoleSceneArc[];
};

export type RoleWorkbookSnapshot = {
  data: RoleWorkbookDataV1;
  note: RoleNoteItem;
};

export type DirectorReferenceImage = {
  key: string;
  /** Optional remote URL returned by upload endpoint (helps avoid play-url calls). */
  url?: string;
  /** Optional token (for backend cleanup scanners). */
  token?: string;
  caption?: string;
};

export type RoleDirectorRefsDataV1 = {
  v: 1;
  /** Client timestamp to resolve ties between server note times. */
  savedAtIso?: string;
  roleId: string;
  images: DirectorReferenceImage[];
};

export type RoleDirectorRefsSnapshot = {
  data: RoleDirectorRefsDataV1;
  note: RoleNoteItem;
};

function safeParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function encodeRoleWorkbookNoteContent(data: RoleWorkbookDataV1): string {
  return `${ROLE_WORKBOOK_MARKER}\n${JSON.stringify(data)}`;
}

export function decodeRoleWorkbookNoteContent(content: string): RoleWorkbookDataV1 | null {
  const text = String(content ?? "");
  if (!text.startsWith(ROLE_WORKBOOK_MARKER)) return null;
  const json = text.slice(ROLE_WORKBOOK_MARKER.length).trim();
  const parsed = safeParseJson(json);
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.v !== 1) return null;
  const actorEmail = normalizeEmail(parsed.actorEmail);
  if (!actorEmail) return null;
  const savedAtIso = typeof parsed.savedAtIso === "string" ? String(parsed.savedAtIso).trim() : "";
  // Backward-compat: `references` was string[] links before.
  const legacyRefsRaw = Array.isArray(parsed.references) ? parsed.references : [];
  const referenceLinksLegacy = legacyRefsRaw
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 80);

  const imgsRaw = Array.isArray(parsed.referenceImages) ? parsed.referenceImages : [];
  const referenceImages: DirectorReferenceImage[] = imgsRaw
    .map((it: any) => {
      const key = String(it?.key ?? "").trim();
      if (!key) return null;
      const url = typeof it?.url === "string" ? String(it.url).trim() : "";
      const token = typeof it?.token === "string" ? String(it.token).trim() : "";
      const caption = typeof it?.caption === "string" ? String(it.caption).trim() : "";
      return {
        key,
        url: url || undefined,
        token: token || `orchestra-image:${encodeURIComponent(key)}`,
        caption: caption || undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 200) as DirectorReferenceImage[];
  const arcsRaw = Array.isArray(parsed.sceneArcs) ? parsed.sceneArcs : [];
  const sceneArcs: RoleSceneArc[] = arcsRaw
    .map((a: any) => {
      const text = String(a?.text ?? "").trim();
      if (!text) return null;
      const stepIdNum = a?.stepId == null ? undefined : Number(a.stepId);
      const stepId =
        stepIdNum != null && Number.isFinite(stepIdNum) && stepIdNum > 0 ? Math.floor(stepIdNum) : undefined;
      const stepTitle = typeof a?.stepTitle === "string" ? a.stepTitle : undefined;
      return { stepId, stepTitle, text };
    })
    .filter(Boolean)
    .slice(0, 200) as RoleSceneArc[];

  return {
    v: 1,
    savedAtIso: savedAtIso || undefined,
    actorEmail,
    biography: String(parsed.biography ?? ""),
    superObjective: String(parsed.superObjective ?? ""),
    appearance: String(parsed.appearance ?? ""),
    referenceImages,
    referenceLinksLegacy,
    preparation: String(parsed.preparation ?? ""),
    sceneArcs,
  };
}

export function pickLatestWorkbookSnapshotForActor(
  notes: RoleNoteItem[],
  actorEmail: string,
): RoleWorkbookSnapshot | null {
  const target = normalizeEmail(actorEmail);
  if (!target) return null;
  let best: RoleWorkbookSnapshot | null = null;
  const rank = (snap: RoleWorkbookSnapshot) => {
    const saved = snap.data?.savedAtIso ? +new Date(snap.data.savedAtIso) : 0;
    const u = +new Date(snap.note.updatedAt || 0);
    const c = +new Date(snap.note.createdAt || 0);
    const id = String(snap.note.id ?? "");
    return { saved, u, c, id };
  };
  const isBetter = (a: RoleWorkbookSnapshot, b: RoleWorkbookSnapshot) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra.saved !== rb.saved) return ra.saved > rb.saved;
    if (ra.u !== rb.u) return ra.u > rb.u;
    if (ra.c !== rb.c) return ra.c > rb.c;
    return ra.id > rb.id;
  };
  for (const n of notes ?? []) {
    const data = decodeRoleWorkbookNoteContent(String(n?.content ?? ""));
    if (!data) continue;
    if (normalizeEmail(data.actorEmail) !== target) continue;
    const snap = { data, note: n };
    if (!best) best = snap;
    else if (isBetter(snap, best)) best = snap;
  }
  return best;
}

export function encodeDirectorRefsNoteContent(data: RoleDirectorRefsDataV1): string {
  return `${ROLE_DIRECTOR_REFS_MARKER}\n${JSON.stringify(data)}`;
}

export function decodeDirectorRefsNoteContent(content: string): RoleDirectorRefsDataV1 | null {
  const text = String(content ?? "");
  if (!text.startsWith(ROLE_DIRECTOR_REFS_MARKER)) return null;
  const json = text.slice(ROLE_DIRECTOR_REFS_MARKER.length).trim();
  const parsed = safeParseJson(json);
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.v !== 1) return null;
  const savedAtIso = typeof parsed.savedAtIso === "string" ? String(parsed.savedAtIso).trim() : "";
  const roleId = String(parsed.roleId ?? "").trim();
  if (!roleId) return null;
  const imagesRaw = Array.isArray(parsed.images) ? parsed.images : [];
  const images: DirectorReferenceImage[] = imagesRaw
    .map((it: any) => {
      const key = String(it?.key ?? "").trim();
      if (!key) return null;
      const url = typeof it?.url === "string" ? String(it.url).trim() : "";
      const token = typeof it?.token === "string" ? String(it.token).trim() : "";
      const caption = typeof it?.caption === "string" ? String(it.caption).trim() : "";
      return {
        key,
        url: url || undefined,
        token: token || `orchestra-image:${encodeURIComponent(key)}`,
        caption: caption || undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 200) as DirectorReferenceImage[];
  return { v: 1, savedAtIso: savedAtIso || undefined, roleId, images };
}

export function pickLatestDirectorRefsSnapshotForRole(
  notes: RoleNoteItem[],
  roleId: string,
): RoleDirectorRefsSnapshot | null {
  const rid = String(roleId ?? "").trim();
  if (!rid) return null;
  let best: RoleDirectorRefsSnapshot | null = null;
  const rank = (snap: RoleDirectorRefsSnapshot) => {
    const saved = snap.data?.savedAtIso ? +new Date(snap.data.savedAtIso) : 0;
    const u = +new Date(snap.note.updatedAt || 0);
    const c = +new Date(snap.note.createdAt || 0);
    const id = String(snap.note.id ?? "");
    return { saved, u, c, id };
  };
  const isBetter = (a: RoleDirectorRefsSnapshot, b: RoleDirectorRefsSnapshot) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra.saved !== rb.saved) return ra.saved > rb.saved;
    if (ra.u !== rb.u) return ra.u > rb.u;
    if (ra.c !== rb.c) return ra.c > rb.c;
    return ra.id > rb.id;
  };
  for (const n of notes ?? []) {
    const data = decodeDirectorRefsNoteContent(String(n?.content ?? ""));
    if (!data) continue;
    if (String(data.roleId) !== rid) continue;
    const snap = { data, note: n };
    if (!best) best = snap;
    else if (isBetter(snap, best)) best = snap;
  }
  return best;
}

export function actorLabel(p: TeamProfile | null, email: string): string {
  const em = String(email ?? "").trim();
  const display = String(p?.displayName ?? "").trim();
  if (display) return `${display} (${em})`;
  const full = `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return `${full} (${em})`;
  return em || "—";
}

