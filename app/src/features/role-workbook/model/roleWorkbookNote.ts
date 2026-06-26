import type { TeamProfile } from "../../../sync/api/profile";
import type { ProjectRoleInfo, RoleNoteItem } from "../../../sync/api/projects";

export const ROLE_WORKBOOK_MARKER = "[[ROLE_WORKBOOK_V1]]";
export const ROLE_DIRECTOR_REFS_MARKER = "[[ROLE_DIRECTOR_REFS_V1]]";

export type RoleDirectorQuestion = {
  text: string;
  sceneId?: number;
  sceneTitle?: string;
};

export type RoleRelationshipEntry = {
  targetRoleId: string;
  text: string;
};

export type RoleSceneArc = {
  sceneId?: number;
  sceneTitle?: string;
  /** Что происходит с персонажем в сцене. */
  text: string;
};

/** Собирает текст сцены из единого поля или из промежуточного формата с 4 полями. */
export function sceneArcDisplayText(raw: Partial<RoleSceneArc> & Record<string, unknown> | null | undefined): string {
  const direct = String(raw?.text ?? "").trim();
  if (direct) return direct;

  const parts: string[] = [];
  const objective = String(raw?.objective ?? "").trim();
  const action = String(raw?.action ?? "").trim();
  const result = String(raw?.result ?? "").trim();
  const shift = String(raw?.shift ?? "").trim();
  if (objective) parts.push(`Задача: ${objective}`);
  if (action) parts.push(`Действие: ${action}`);
  if (result) parts.push(`Результат: ${result}`);
  if (shift) parts.push(`Сдвиг: ${shift}`);
  return parts.join("\n");
}

export function sceneArcHasContent(arc: Partial<RoleSceneArc> | null | undefined): boolean {
  return Boolean(sceneArcDisplayText(arc as any));
}

export function normalizeSceneArc(raw: Partial<RoleSceneArc> | null | undefined): RoleSceneArc | null {
  const sceneIdNum = raw?.sceneId == null ? undefined : Number(raw.sceneId);
  const sceneId =
    sceneIdNum != null && Number.isFinite(sceneIdNum) && sceneIdNum > 0 ? Math.floor(sceneIdNum) : undefined;
  const sceneTitle = typeof raw?.sceneTitle === "string" ? raw.sceneTitle : undefined;
  const text = sceneArcDisplayText(raw as any);

  if (!text && sceneId == null) return null;

  return { sceneId, sceneTitle, text };
}

export type RoleWorkbookDataV1 = {
  v: 1;
  /** Client timestamp to resolve ties between server note times. */
  savedAtIso?: string;
  actorEmail: string;
  /** Данные обстоятельства: время, место, среда пьесы. */
  givenCircumstances: string;
  /** Биография и внерамочная жизнь. */
  biography: string;
  /** Социальный портрет: возраст, профессия, среда, речь, привычки. */
  socialPortrait: string;
  /** Отношения с другими персонажами (общие заметки, legacy). */
  relationships: string;
  /** Отношения к конкретным персонажам пьесы. */
  relationshipEntries: RoleRelationshipEntry[];
  /** Сверхзадача и сквозное действие. */
  superObjective: string;
  /** Препятствия на пути к цели. */
  obstacles: string;
  /** Событийный ряд: ключевые события жизни героя в пьесе. */
  eventSeries: string;
  /** Кем был в начале пьесы. */
  transformationStart: string;
  /** Кем стал к финалу. */
  transformationEnd: string;
  /** Главный перелом / поворотная точка. */
  transformationTurningPoint: string;
  /** Внешность, пластика, голос. */
  appearance: string;
  /** New: image refs (remote keys). */
  referenceImages: DirectorReferenceImage[];
  /** Legacy: old link-based references (kept for backward compat). */
  referenceLinksLegacy: string[];
  preparation: string; // заметки "как готовиться"
  sceneArcs: RoleSceneArc[];
  /** Вопросы режиссёру по роли и сценам. */
  directorQuestions: RoleDirectorQuestion[];
  /** Репетиционный чеклист: что отработано. */
  rehearsalDone: string;
  /** Что ещё не отработано. */
  rehearsalTodo: string;
  /** Следующий шаг на ближайшую репетицию. */
  rehearsalNextStep: string;
};

export function normalizeDirectorQuestion(
  raw: Partial<RoleDirectorQuestion> | null | undefined,
): RoleDirectorQuestion | null {
  const text = String(raw?.text ?? "").trim();
  if (!text) return null;
  const sceneIdNum = raw?.sceneId == null ? undefined : Number(raw.sceneId);
  const sceneId =
    sceneIdNum != null && Number.isFinite(sceneIdNum) && sceneIdNum > 0 ? Math.floor(sceneIdNum) : undefined;
  const sceneTitle = typeof raw?.sceneTitle === "string" ? raw.sceneTitle : undefined;
  return { text, sceneId, sceneTitle };
}

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
    .map((x: unknown) => String(x ?? "").trim())
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
        token: token || `![reference](orchestra-image:${encodeURIComponent(key)})`,
        caption: caption || undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 200) as DirectorReferenceImage[];
  const arcsRaw = Array.isArray(parsed.sceneArcs) ? parsed.sceneArcs : [];
  const sceneArcs: RoleSceneArc[] = arcsRaw
    .map((a: any) => normalizeSceneArc(a))
    .filter(Boolean)
    .slice(0, 200) as RoleSceneArc[];

  const relEntriesRaw = Array.isArray(parsed.relationshipEntries) ? parsed.relationshipEntries : [];
  const relationshipEntries: RoleRelationshipEntry[] = relEntriesRaw
    .map((it: any) => {
      const targetRoleId = String(it?.targetRoleId ?? "").trim();
      const text = String(it?.text ?? "").trim();
      if (!targetRoleId) return null;
      return { targetRoleId, text };
    })
    .filter(Boolean)
    .slice(0, 80) as RoleRelationshipEntry[];

  const questionsRaw = Array.isArray(parsed.directorQuestions) ? parsed.directorQuestions : [];
  const directorQuestions: RoleDirectorQuestion[] = questionsRaw
    .map((it: any) => normalizeDirectorQuestion(it))
    .filter(Boolean)
    .slice(0, 80) as RoleDirectorQuestion[];

  return {
    v: 1,
    savedAtIso: savedAtIso || undefined,
    actorEmail,
    givenCircumstances: String(parsed.givenCircumstances ?? ""),
    biography: String(parsed.biography ?? ""),
    socialPortrait: String(parsed.socialPortrait ?? ""),
    relationships: String(parsed.relationships ?? ""),
    relationshipEntries,
    superObjective: String(parsed.superObjective ?? ""),
    obstacles: String(parsed.obstacles ?? ""),
    eventSeries: String(parsed.eventSeries ?? ""),
    transformationStart: String(parsed.transformationStart ?? ""),
    transformationEnd: String(parsed.transformationEnd ?? ""),
    transformationTurningPoint: String(parsed.transformationTurningPoint ?? ""),
    appearance: String(parsed.appearance ?? ""),
    referenceImages,
    referenceLinksLegacy,
    preparation: String(parsed.preparation ?? ""),
    sceneArcs,
    directorQuestions,
    rehearsalDone: String(parsed.rehearsalDone ?? ""),
    rehearsalTodo: String(parsed.rehearsalTodo ?? ""),
    rehearsalNextStep: String(parsed.rehearsalNextStep ?? ""),
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
        token: token || `![reference](orchestra-image:${encodeURIComponent(key)})`,
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

/** Что другие актёры написали о текущем персонаже в своих тетрадках (блок «отношения»). */
export type InboundRoleMention = {
  sourceRoleId: string;
  sourceRoleTitle: string;
  sourceRoleAvatarKey?: string | null;
  actorEmail: string;
  text: string;
  updatedAtIso: string;
};

export function collectInboundMentions(params: {
  targetRoleId: string;
  projectRoles: ProjectRoleInfo[];
  notesByRoleId: Map<string, RoleNoteItem[]> | Record<string, RoleNoteItem[]>;
}): InboundRoleMention[] {
  const target = String(params.targetRoleId ?? "").trim();
  if (!target) return [];

  const roleById = new Map<string, ProjectRoleInfo>();
  for (const r of params.projectRoles ?? []) roleById.set(String(r.id), r);

  const notesMap =
    params.notesByRoleId instanceof Map
      ? params.notesByRoleId
      : new Map(Object.entries(params.notesByRoleId ?? {}));

  const out: InboundRoleMention[] = [];

  for (const [sourceRoleId, notes] of notesMap.entries()) {
    if (String(sourceRoleId) === target) continue;
    const sourceRole = roleById.get(String(sourceRoleId));
    const sourceRoleTitle = String(sourceRole?.title ?? sourceRole?.key ?? sourceRoleId).trim();
    const sourceRoleAvatarKey = sourceRole?.avatarKey ?? null;

    const actorEmails = new Set<string>();
    for (const n of notes ?? []) {
      const data = decodeRoleWorkbookNoteContent(String(n?.content ?? ""));
      if (!data) continue;
      const em = normalizeEmail(data.actorEmail);
      if (em) actorEmails.add(em);
    }

    for (const actorEmail of actorEmails) {
      const snap = pickLatestWorkbookSnapshotForActor(notes ?? [], actorEmail);
      if (!snap) continue;
      const updatedAtIso = String(
        snap.data.savedAtIso || snap.note.updatedAt || snap.note.createdAt || "",
      ).trim();

      for (const entry of snap.data.relationshipEntries ?? []) {
        if (String(entry.targetRoleId) !== target) continue;
        const text = String(entry.text ?? "").trim();
        if (!text) continue;
        out.push({
          sourceRoleId: String(sourceRoleId),
          sourceRoleTitle,
          sourceRoleAvatarKey,
          actorEmail,
          text,
          updatedAtIso,
        });
      }
    }
  }

  out.sort((a, b) => +new Date(b.updatedAtIso || 0) - +new Date(a.updatedAtIso || 0));
  return out;
}

export function actorLabel(p: TeamProfile | null, email: string): string {
  const em = String(email ?? "").trim();
  const display = String(p?.displayName ?? "").trim();
  if (display) return `${display} (${em})`;
  const full = `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return `${full} (${em})`;
  return em || "—";
}

