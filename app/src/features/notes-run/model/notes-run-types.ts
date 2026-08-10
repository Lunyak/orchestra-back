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
  /** Id сцены сценария (ScriptScene.id), если карточка привязана. */
  sceneId: number | null;
  /** Подпись сцены для отображения (кэш title; при наличии sceneId синхронизируется). */
  sceneLabel: string;
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
  sceneId: number | null;
  sceneLabel: string;
  lightLines: NotesRunLightLineV1[];
  lightNotes: string;
  playTrackId: number | null;
  soundIds: number[];
  projectorCue: KadrProjectorCue | null;
  transitionText: string;
  commentText: string;
};

export type NotesRunSceneGroup = {
  sceneIndex: number;
  sceneId: number | null;
  sceneOrdinal: number;
  sceneTitle: string;
  items: Array<{ cardIndex: number; card: NotesRunCardV1 }>;
};
