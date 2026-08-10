import { createId } from "../../../shared/utils/createId";
import { readLegacySceneLabel } from "../../../shared/playbook/legacy-scene-json";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { fetchDevLocalProjectJson } from "../../../shared/platform/local-project-dev";
import { readProjectFolderJson } from "../../../shared/platform/project-media-folder";
import type { ScriptScene } from "../../../shared/types/script";
import type {
  NotesRunCardDraft,
  NotesRunCardV1,
  NotesRunDataV1,
  NotesRunSceneGroup,
} from "./notes-run-types";

function readSceneId(raw: Partial<NotesRunCardV1> | Record<string, unknown>): number | null {
  const value = Number((raw as { sceneId?: unknown }).sceneId);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

export function normalizeNotesRunData(raw: unknown): NotesRunDataV1 {
  const data = raw as NotesRunDataV1 | null | undefined;
  if (!data || data.v !== 1 || !Array.isArray(data.cards)) {
    return { v: 1, cards: [] };
  }
  const cards = data.cards
    .map((card, index) => normalizeNotesRunCard(card, index + 1))
    .filter((card): card is NotesRunCardV1 => card != null)
    .sort((a, b) => a.cardNo - b.cardNo || a.id.localeCompare(b.id));
  return { v: 1, cards: renumberNotesRunCards(cards) };
}

function normalizeNotesRunCard(raw: Partial<NotesRunCardV1>, fallbackNo: number): NotesRunCardV1 | null {
  const id = String(raw?.id ?? "").trim() || createId();
  const cardNo = Math.max(1, Math.trunc(Number(raw?.cardNo) || fallbackNo) || fallbackNo);
  const lightLines = Array.isArray(raw?.lightLines)
    ? raw.lightLines
        .map((row) => ({
          label: String(row?.label ?? "").trim(),
          value: String(row?.value ?? "").trim(),
        }))
        .filter((row) => row.label || row.value)
    : [];
  return {
    id,
    cardNo,
    title: String(raw?.title ?? "").trim(),
    sceneId: readSceneId(raw ?? {}),
    sceneLabel: readLegacySceneLabel(raw as Record<string, unknown>),
    lightLines,
    lightNotes: String(raw?.lightNotes ?? "").trim(),
    playTrackId:
      raw?.playTrackId != null && Number(raw.playTrackId) > 0
        ? Math.trunc(Number(raw.playTrackId))
        : null,
    soundIds: Array.isArray(raw?.soundIds)
      ? [...new Set(raw.soundIds.map((id) => Math.trunc(Number(id) || 0)).filter((id) => id > 0))]
      : [],
    projectorCue: raw?.projectorCue ?? null,
    transitionText: String(raw?.transitionText ?? "").trim(),
    commentText: String(raw?.commentText ?? "").trim(),
  };
}

export function renumberNotesRunCards(cards: NotesRunCardV1[]): NotesRunCardV1[] {
  return cards.map((card, index) => ({ ...card, cardNo: index + 1 }));
}

function notesRunLocalStorageKey(projectSlug: string): string {
  return `notes-run:v1:${projectSlug}`;
}

function saveNotesRunLocalBackup(projectSlug: string, data: NotesRunDataV1): void {
  if (typeof window === "undefined" || !projectSlug) return;
  try {
    localStorage.setItem(
      notesRunLocalStorageKey(projectSlug),
      JSON.stringify(normalizeNotesRunData(data)),
    );
  } catch {
    /* quota / private mode */
  }
}

function readNotesRunLocalBackup(projectSlug: string): NotesRunDataV1 | null {
  if (typeof window === "undefined" || !projectSlug) return null;
  try {
    const raw = localStorage.getItem(notesRunLocalStorageKey(projectSlug));
    if (!raw) return null;
    const parsed = normalizeNotesRunData(JSON.parse(raw));
    return parsed.cards.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Загрузка суфлера — только локально, sync не участвует. */
export async function loadNotesRun(projectSlug: string): Promise<NotesRunDataV1> {
  if (!projectSlug) return { v: 1, cards: [] };

  const api = getDesktopApi();
  if (api?.readNotesRun) {
    try {
      const raw = await api.readNotesRun(projectSlug);
      const fromFile = normalizeNotesRunData(raw);
      if (fromFile.cards.length > 0) {
        saveNotesRunLocalBackup(projectSlug, fromFile);
        return fromFile;
      }
    } catch {
      /* notes-run.json missing or unreadable */
    }

    if (api.readProjectPlaybook) {
      try {
        const script = await api.readProjectPlaybook(projectSlug, "script");
        const legacy = normalizeNotesRunData((script as { lightNotesRun?: unknown })?.lightNotesRun);
        if (legacy.cards.length > 0) {
          await saveNotesRun(projectSlug, legacy);
          return legacy;
        }
      } catch {
        /* ignore */
      }
    }
  }

  try {
    const folderRaw = await readProjectFolderJson(projectSlug, "notes-run");
    if (folderRaw) {
      const fromFolder = normalizeNotesRunData(folderRaw);
      if (fromFolder.cards.length > 0) {
        saveNotesRunLocalBackup(projectSlug, fromFolder);
        return fromFolder;
      }
    }
  } catch {
    /* folder notes-run missing */
  }

  try {
    const devRaw = await fetchDevLocalProjectJson(projectSlug, "notes-run");
    if (devRaw) {
      const fromFile = normalizeNotesRunData(devRaw);
      if (fromFile.cards.length > 0) {
        saveNotesRunLocalBackup(projectSlug, fromFile);
        return fromFile;
      }
    }
  } catch {
    /* dev local notes-run missing */
  }

  return readNotesRunLocalBackup(projectSlug) ?? { v: 1, cards: [] };
}

/** Сохранение суфлера — отдельный файл + localStorage, без script.json и сервера. */
export async function saveNotesRun(projectSlug: string, data: NotesRunDataV1): Promise<void> {
  const normalized = normalizeNotesRunData(data);
  saveNotesRunLocalBackup(projectSlug, normalized);

  const api = getDesktopApi();
  if (!api?.saveNotesRun) return;

  const result = await api.saveNotesRun(projectSlug, normalized);
  if (!result?.ok) {
    throw new Error(result?.error ?? "Не удалось сохранить суфлер");
  }
}

export function sceneTitleAt(scenes: ScriptScene[], index: number): string {
  const scene = scenes[index];
  const ordinal = index + 1;
  return String(scene?.title ?? "").trim() || `Сцена ${ordinal}`;
}

/** Подтягивает sceneLabel из актуальных сцен по sceneId; для старых карточек — матч по title. */
export function syncNotesRunCardsWithScenes(
  cards: NotesRunCardV1[],
  scenes: ScriptScene[],
): NotesRunCardV1[] {
  if (scenes.length === 0) return cards;

  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const byTitle = new Map<string, ScriptScene>();
  for (const scene of scenes) {
    const title = String(scene.title ?? "").trim();
    if (title && !byTitle.has(title)) byTitle.set(title, scene);
  }

  return cards.map((card) => {
    const bySceneId = card.sceneId != null ? byId.get(card.sceneId) : undefined;
    if (bySceneId) {
      const sceneLabel = String(bySceneId.title ?? "").trim() || card.sceneLabel;
      if (sceneLabel === card.sceneLabel && card.sceneId === bySceneId.id) return card;
      return { ...card, sceneId: bySceneId.id, sceneLabel };
    }

    const label = card.sceneLabel.trim();
    if (!label || card.sceneId != null) return card;
    const matched = byTitle.get(label);
    if (!matched) return card;
    return {
      ...card,
      sceneId: matched.id,
      sceneLabel: String(matched.title ?? "").trim() || label,
    };
  });
}

export function buildNotesRunSceneGroups(
  cards: NotesRunCardV1[],
  scenes: ScriptScene[],
): NotesRunSceneGroup[] {
  const groups: NotesRunSceneGroup[] = [];
  const sceneIndexById = new Map(scenes.map((scene, index) => [scene.id, index]));

  cards.forEach((card, cardIndex) => {
    const sceneIndex =
      card.sceneId != null ? (sceneIndexById.get(card.sceneId) ?? -1) : -1;
    const sceneOrdinal = sceneIndex >= 0 ? sceneIndex + 1 : 0;
    const sceneTitle =
      sceneIndex >= 0
        ? sceneTitleAt(scenes, sceneIndex)
        : card.sceneLabel.trim() || "Без сцены";
    const groupKey = card.sceneId ?? `label:${sceneTitle}`;
    const last = groups[groups.length - 1];
    const lastKey = last
      ? (last.sceneId ?? `label:${last.sceneTitle}`)
      : null;

    if (!last || lastKey !== groupKey) {
      groups.push({
        sceneIndex,
        sceneId: card.sceneId,
        sceneOrdinal,
        sceneTitle,
        items: [{ cardIndex, card }],
      });
      return;
    }

    last.items.push({ cardIndex, card });
  });

  return groups;
}

export function findFirstCardIndexForScene(
  cards: NotesRunCardV1[],
  scenes: ScriptScene[],
  sceneIndex: number,
): number {
  const scene = scenes[sceneIndex];
  if (!scene) return -1;
  const byId = cards.findIndex((card) => card.sceneId === scene.id);
  if (byId >= 0) return byId;
  const title = String(scene.title ?? "").trim();
  if (!title) return -1;
  return cards.findIndex((card) => card.sceneLabel.trim() === title);
}

export function buildEmptyNotesRunDraft(
  scene?: ScriptScene | null,
  sceneIndex = 0,
): NotesRunCardDraft {
  const sceneLabel = scene
    ? String(scene.title ?? "").trim() || `Сцена ${sceneIndex + 1}`
    : "";
  return {
    title: "",
    sceneId: scene?.id ?? null,
    sceneLabel,
    lightLines: [{ label: "", value: "" }],
    lightNotes: "",
    playTrackId: null,
    soundIds: [],
    projectorCue: null,
    transitionText: "",
    commentText: "",
  };
}

export function buildNotesRunDraftFromCard(card: NotesRunCardV1): NotesRunCardDraft {
  return {
    title: card.title,
    sceneId: card.sceneId,
    sceneLabel: card.sceneLabel,
    lightLines:
      card.lightLines.length > 0
        ? card.lightLines.map((row) => ({ ...row }))
        : [{ label: "", value: "" }],
    lightNotes: card.lightNotes,
    playTrackId: card.playTrackId,
    soundIds: [...card.soundIds],
    projectorCue: card.projectorCue,
    transitionText: card.transitionText,
    commentText: card.commentText,
  };
}

export function applyNotesRunDraft(
  cards: NotesRunCardV1[],
  cardId: string | null,
  draft: NotesRunCardDraft,
  opts?: { insertAtIndex?: number },
): NotesRunDataV1 {
  const lightLines = draft.lightLines
    .map((row) => ({
      label: row.label.trim(),
      value: row.value.trim(),
    }))
    .filter((row) => row.label || row.value);

  const nextCard: NotesRunCardV1 = {
    id: cardId ?? createId(),
    cardNo: cardId ? cards.find((c) => c.id === cardId)?.cardNo ?? cards.length + 1 : cards.length + 1,
    title: draft.title.trim(),
    sceneId: draft.sceneId != null && draft.sceneId > 0 ? draft.sceneId : null,
    sceneLabel: draft.sceneLabel.trim(),
    lightLines,
    lightNotes: draft.lightNotes.trim(),
    playTrackId: draft.playTrackId != null && draft.playTrackId > 0 ? draft.playTrackId : null,
    soundIds: [...new Set(draft.soundIds.filter((id) => id > 0))],
    projectorCue: draft.projectorCue,
    transitionText: draft.transitionText.trim(),
    commentText: draft.commentText.trim(),
  };

  if (cardId) {
    const nextCards = cards.map((card) => (card.id === cardId ? nextCard : card));
    return normalizeNotesRunData({ v: 1, cards: nextCards });
  }

  const insertAt =
    opts?.insertAtIndex != null
      ? Math.max(0, Math.min(Math.trunc(opts.insertAtIndex), cards.length))
      : cards.length;
  const nextCards = [...cards.slice(0, insertAt), nextCard, ...cards.slice(insertAt)];
  return normalizeNotesRunData({ v: 1, cards: renumberNotesRunCards(nextCards) });
}

/** Одна пустая карточка на каждую сцену сценария — скелет рукописной программы. */
export function buildNotesRunCardsFromScenes(scenes: ScriptScene[]): NotesRunDataV1 {
  const cards: NotesRunCardV1[] = scenes.map((scene, index) => ({
    id: createId(),
    cardNo: index + 1,
    title: "",
    sceneId: scene.id,
    sceneLabel: String(scene.title ?? "").trim() || `Сцена ${index + 1}`,
    lightLines: [],
    lightNotes: "",
    playTrackId: null,
    soundIds: [],
    projectorCue: null,
    transitionText: "",
    commentText: "",
  }));
  return { v: 1, cards };
}
