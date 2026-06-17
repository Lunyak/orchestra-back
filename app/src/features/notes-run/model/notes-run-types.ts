import type { KadrProjectorCue } from "../../theater/model/kadr-projector";

/** Одна строка света — любые подписи и значения, без привязки к K/F/3D. */
export type NotesRunLightLineV1 = {
  label: string;
  value: string;
};

export type NotesRunCardV1 = {
  id: string;
  cardNo: number;
  title: string;
  /** Произвольная метка шага сценария (текст, не id). */
  stepLabel: string;
  lightLines: NotesRunLightLineV1[];
  /** Доп. текст по свету — если не хватает таблицы строк. */
  lightNotes: string;
  playTrackId: number | null;
  soundIds: number[];
  projectorCue: KadrProjectorCue | null;
  transitionText: string;
  commentText: string;
};

export type NotesRunDataV1 = {
  v: 1;
  cards: NotesRunCardV1[];
};

export type NotesRunCardDraft = {
  title: string;
  stepLabel: string;
  lightLines: NotesRunLightLineV1[];
  lightNotes: string;
  playTrackId: number | null;
  soundIds: number[];
  projectorCue: KadrProjectorCue | null;
  transitionText: string;
  commentText: string;
};
