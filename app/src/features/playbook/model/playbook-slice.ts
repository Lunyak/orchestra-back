import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ScriptScene, TheaterLayout } from "../../../shared/types/script";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { sceneHasMaterial } from "./scenario-material";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import { attachPlaybookThunkExtraReducers } from "./playbook-slice-extra-reducers";
import {
  mergeProjectorPlaybookDataOnHydrate,
  normalizeHydratedScenes,
} from "./playbook-slice-helpers";
import {
  DEFAULT_THEATER_LAYOUT,
  playbookInitialState,
  type PlaybookData,
  type PlaybookHoldImage,
  type PlaybookState,
  type PlaybookVideo,
  type SceneProjectorSettingsV1,
  type SceneSound,
  type SceneVoiceLineEntry,
  type TheaterLayoutUpdater,
} from "./playbook-types";

export const playbookSlice = createSlice({
  name: "playbook",
  initialState: playbookInitialState,
  reducers: {
    resetForProject(state) {
      state.playbookData = null;
      state.scenes = [];
      state.theaterLayout = DEFAULT_THEATER_LAYOUT;
      state.serverShadow = null;
      state.currentPage = 0;
      state.isPlaybookReady = false;
      state.hasLocalEdits = false;
      state.scenesRevision += 1;
      state.playbookDataRevision += 1;
      state.serverShadowRevision += 1;
    },
    hydratePlaybook(
      state,
      action: PayloadAction<{
        playbookData: PlaybookData | null;
        scenes: ScriptScene[];
        theaterLayout: TheaterLayout;
        /** Если не передан — сохраняем страницу по id выбранной сцены (пул с сервера / регидрация). */
        currentPage?: number;
        isPlaybookReady: boolean;
        serverShadow?: {
          playbookData: PlaybookData | null;
          scenes: ScriptScene[];
          theaterLayout: TheaterLayout;
          lightChannels: string[];
        } | null;
      }>,
    ) {
      const prevScenes = state.scenes;
      const prevPage = state.currentPage;
      const prevSelectedId = prevScenes[prevPage]?.id ?? null;

      state.playbookData = mergeProjectorPlaybookDataOnHydrate(
        action.payload.playbookData,
        state.playbookData,
      );
      const nextScenes = normalizeHydratedScenes(action.payload.scenes);
      state.scenes = nextScenes;
      state.theaterLayout = action.payload.theaterLayout;

      const payloadPage = action.payload.currentPage;
      const safeMax = Math.max(0, nextScenes.length - 1);
      if (payloadPage !== undefined) {
        state.currentPage = payloadPage;
      } else if (prevSelectedId != null) {
        const idx = nextScenes.findIndex((s) => s.id === prevSelectedId);
        state.currentPage = idx !== -1 ? idx : Math.min(prevPage, safeMax);
      } else {
        state.currentPage = Math.min(prevPage, safeMax);
      }

      state.isPlaybookReady = action.payload.isPlaybookReady;
      state.hasLocalEdits = false;
      state.scenesRevision += 1;
      state.playbookDataRevision += 1;
      if (Object.prototype.hasOwnProperty.call(action.payload, "serverShadow")) {
        state.serverShadow = action.payload.serverShadow ?? null;
        state.serverShadowRevision += 1;
      }
    },
    setPlaybookReady(state, action: PayloadAction<boolean>) {
      state.isPlaybookReady = action.payload;
    },
    setServerShadow(
      state,
      action: PayloadAction<{
        playbookData: PlaybookData | null;
        scenes: ScriptScene[];
        theaterLayout: TheaterLayout;
        lightChannels: string[];
      } | null>,
    ) {
      state.serverShadow = action.payload;
      state.serverShadowRevision += 1;
    },
    setPlaybookData(state, action: PayloadAction<PlaybookData | null>) {
      state.playbookData = action.payload;
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    setRoleAssignments(state, action: PayloadAction<Record<string, string[]>>) {
      state.playbookData = { ...(state.playbookData ?? {}), roleAssignments: action.payload };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    setPreferredVoiceLineTake(
      state,
      action: PayloadAction<{ lineId: string; performerId: string; takeId: string }>,
    ) {
      const { lineId, performerId, takeId } = action.payload;
      const prev = state.playbookData?.voiceLines;
      if (!prev?.byLineId) return;
      const entry = prev.byLineId[lineId];
      if (!entry) return;
      const nextPreferred = {
        ...(entry.preferredTakeIdByPerformer ?? {}),
        [performerId]: takeId,
      };
      const nextEntry: SceneVoiceLineEntry = { ...entry, preferredTakeIdByPerformer: nextPreferred };
      state.playbookData = {
        ...(state.playbookData ?? {}),
        voiceLines: {
          version: 1,
          byLineId: {
            ...prev.byLineId,
            [lineId]: nextEntry,
          },
        },
      };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    setScenes(state, action: PayloadAction<ScriptScene[]>) {
      state.scenes = normalizeHydratedScenes(action.payload);
      state.hasLocalEdits = true;
      state.scenesRevision += 1;
    },
    updateScene(state, action: PayloadAction<{ id: number; changes: Partial<ScriptScene> }>) {
      const { id, changes } = action.payload;
      const idx = state.scenes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      state.scenes[idx] = { ...state.scenes[idx], ...changes };
      state.hasLocalEdits = true;
      state.scenesRevision += 1;
    },
    resetAllRequisites(state) {
      state.scenes = state.scenes.map((scene) => ({
        ...scene,
        requisites: (scene.requisites ?? []).map((item) => ({ ...item, checked: false })),
      }));
      state.hasLocalEdits = true;
      state.scenesRevision += 1;
    },
    setTheaterLayout(state, action: PayloadAction<TheaterLayoutUpdater>) {
      const resolved =
        typeof action.payload === "function"
          ? action.payload(state.theaterLayout)
          : action.payload;
      state.theaterLayout = normalizePersistedTheaterLayout(resolved);
      state.hasLocalEdits = true;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    seedScenarioFromPlayText(state, action: PayloadAction<{ text: string }>) {
      const text = String(action.payload.text ?? "").trim();
      if (!text) return;
      state.hasLocalEdits = true;

      const titleFromText = "Пьеса";

      if (state.scenes.length === 0) {
        state.scenes = [
          {
            id: 1,
            title: titleFromText,
            markdown: "",
            playMarkdown: text,
          },
        ];
        state.currentPage = 0;
        state.scenesRevision += 1;
        return;
      }

      const emptyIndex = state.scenes.findIndex((scene) => !sceneHasMaterial(scene));
      if (emptyIndex !== -1) {
        const scene = state.scenes[emptyIndex];
        const keepTitle =
          scene.title?.trim() && scene.title.trim() !== "Новая сцена" && scene.title.trim() !== "Новый шаг"
            ? scene.title.trim()
            : titleFromText;
        state.scenes[emptyIndex] = {
          ...scene,
          title: keepTitle,
          playMarkdown: text,
        };
        state.currentPage = emptyIndex;
        state.scenesRevision += 1;
        return;
      }

      const nextId = state.scenes.reduce((acc, scene) => Math.max(acc, scene.id), 0) + 1;
      state.scenes.unshift({
        id: nextId,
        title: titleFromText,
        markdown: "",
        playMarkdown: text,
      });
      state.currentPage = 0;
      state.scenesRevision += 1;
    },
    addScene(state) {
      state.hasLocalEdits = true;
      const nextId = state.scenes.reduce((acc, scene) => Math.max(acc, scene.id), 0) + 1;
      // Добавляем новую сцену всегда в конец списка (а не после текущей).
      const insertIndex = state.scenes.length;
      const sourceScene = state.scenes[state.currentPage];
      const nextRequisites = sourceScene?.requisites
        ? sourceScene.requisites.map((item) => ({ ...item, checked: false }))
        : [];
      const nextItem: ScriptScene = {
        id: nextId,
        title: `Сцена ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      state.scenes.splice(insertIndex, 0, nextItem);
      state.currentPage = insertIndex;
      state.scenesRevision += 1;
    },
    splitSceneFromSelection(
      state,
      action: PayloadAction<{
        sourceSceneId: number;
        targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
        selectedText: string;
        trimmedSourceText: string;
      }>,
    ) {
      const { sourceSceneId, targetField, selectedText, trimmedSourceText } = action.payload;
      const sourceIdx = state.scenes.findIndex((s) => s.id === sourceSceneId);
      if (sourceIdx === -1) return;

      const sourceScene = state.scenes[sourceIdx];
      state.scenes[sourceIdx] = { ...sourceScene, [targetField]: trimmedSourceText };

      const nextId = state.scenes.reduce((acc, scene) => Math.max(acc, scene.id), 0) + 1;
      const nextRequisites = sourceScene.requisites
        ? sourceScene.requisites.map((item) => ({ ...item, checked: false }))
        : [];
      const nextItem: ScriptScene = {
        id: nextId,
        title: `Сцена ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      if (targetField === "markdown") {
        nextItem.markdown = selectedText;
      } else if (targetField === "playMarkdown") {
        nextItem.playMarkdown = selectedText;
      } else {
        nextItem.explicationMarkdown = selectedText;
      }

      state.scenes.push(nextItem);
      state.currentPage = state.scenes.length - 1;
      state.hasLocalEdits = true;
      state.scenesRevision += 1;
    },
    splitSceneContentIntoScenes(
      state,
      action: PayloadAction<{
        sourceSceneId: number;
        targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
        chunks: string[];
        chunkTitles?: string[];
      }>,
    ) {
      const { sourceSceneId, targetField, chunks, chunkTitles } = action.payload;
      const trimmedChunks = chunks.map((c) => String(c ?? "").trim()).filter(Boolean);
      if (!trimmedChunks.length) return;

      const sourceIdx = state.scenes.findIndex((s) => s.id === sourceSceneId);
      if (sourceIdx === -1) return;

      const sourceScene = state.scenes[sourceIdx];
      let maxId = state.scenes.reduce((acc, scene) => Math.max(acc, scene.id), 0);

      const makeScene = (chunk: string, title: string): ScriptScene => {
        maxId += 1;
        const nextRequisites = sourceScene.requisites
          ? sourceScene.requisites.map((item) => ({ ...item, checked: false }))
          : [];
        const nextItem: ScriptScene = {
          id: maxId,
          title,
          markdown: "",
          requisites: nextRequisites,
        };
        nextItem[targetField] = chunk;
        return nextItem;
      };

      const [firstChunk, ...restChunks] = trimmedChunks;
      const firstTitle =
        chunkTitles?.[0]?.trim() ||
        sourceScene.title ||
        `Сцена ${sourceScene.id}`;
      state.scenes[sourceIdx] = {
        ...sourceScene,
        title: firstTitle,
        [targetField]: firstChunk,
      };

      let insertAt = sourceIdx + 1;
      restChunks.forEach((chunk, index) => {
        const title =
          chunkTitles?.[index + 1]?.trim() || `Сцена ${maxId + 1}`;
        state.scenes.splice(insertAt, 0, makeScene(chunk, title));
        insertAt += 1;
      });

      state.currentPage = sourceIdx;
      state.hasLocalEdits = true;
      state.scenesRevision += 1;
    },
    deleteScene(state, action: PayloadAction<number>) {
      state.hasLocalEdits = true;
      const id = action.payload;
      const next = state.scenes.filter((s) => s.id !== id);
      state.scenes = next;
      state.currentPage = next.length === 0 ? 0 : Math.min(state.currentPage, next.length - 1);
      state.scenesRevision += 1;
    },
    reorderScenes(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= state.scenes.length || toIndex >= state.scenes.length) return;
      state.hasLocalEdits = true;
      const [moved] = state.scenes.splice(fromIndex, 1);
      state.scenes.splice(toIndex, 0, moved);
      const prev = state.currentPage;
      if (prev === fromIndex) state.currentPage = toIndex;
      else if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) state.currentPage = prev - 1;
      else if (fromIndex > toIndex && prev < fromIndex && prev >= toIndex) state.currentPage = prev + 1;
      state.scenesRevision += 1;
    },
    markSaved(state) {
      state.hasLocalEdits = false;
    },
    setRealtimePullDeferred(
      state,
      action: PayloadAction<{
        deferred: boolean;
        at?: string | null;
        reason?: PlaybookState["realtimePullDeferredReason"];
      }>,
    ) {
      const deferred = Boolean(action.payload?.deferred);
      state.realtimePullDeferred = deferred;
      state.realtimePullDeferredAt =
        action.payload?.at ?? (deferred ? new Date().toISOString() : null);
      if (!deferred) {
        state.realtimePullDeferredReason = null;
      } else {
        state.realtimePullDeferredReason =
          action.payload?.reason ?? "remote_pending";
      }
    },
    clearRealtimePullDeferred(state) {
      state.realtimePullDeferred = false;
      state.realtimePullDeferredAt = null;
      state.realtimePullDeferredReason = null;
    },
    addSounds(state, action: PayloadAction<SceneSound[]>) {
      const next = action.payload ?? [];
      if (next.length === 0) return;
      const prev = (state.playbookData as any)?.sounds;
      const prevList = Array.isArray(prev) ? prev : [];
      state.playbookData = { ...(state.playbookData ?? {}), sounds: [...prevList, ...next] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    updateSound(
      state,
      action: PayloadAction<{ id: number; changes: Partial<SceneSound> }>,
    ) {
      const listRaw = (state.playbookData as any)?.sounds;
      const list = Array.isArray(listRaw) ? listRaw : [];
      const idx = list.findIndex((s: any) => Number(s?.id) === action.payload.id);
      if (idx === -1) return;
      const nextItem = { ...list[idx], ...action.payload.changes };
      const next = [...list];
      next[idx] = nextItem;
      state.playbookData = { ...(state.playbookData ?? {}), sounds: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    removeSound(state, action: PayloadAction<number>) {
      const listRaw = (state.playbookData as any)?.sounds;
      const list = Array.isArray(listRaw) ? listRaw : [];
      const next = list.filter((s: any) => Number(s?.id) !== action.payload);
      state.playbookData = { ...(state.playbookData ?? {}), sounds: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    setPlaylist(state, action: PayloadAction<PlaylistTrack[]>) {
      state.playbookData = { ...(state.playbookData ?? {}), playlist: action.payload ?? [] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    updatePlaylistTrack(
      state,
      action: PayloadAction<{ id: number; changes: Partial<PlaylistTrack> }>,
    ) {
      const list = Array.isArray(state.playbookData?.playlist) ? state.playbookData!.playlist! : [];
      const idx = list.findIndex((t) => Number(t?.id) === Number(action.payload.id));
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...action.payload.changes };
      state.playbookData = { ...(state.playbookData ?? {}), playlist: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    reorderPlaylist(
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>,
    ) {
      const list = Array.isArray(state.playbookData?.playlist) ? state.playbookData!.playlist! : [];
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= list.length || toIndex >= list.length) return;
      const next = [...list];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      state.playbookData = { ...(state.playbookData ?? {}), playlist: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    addVideos(state, action: PayloadAction<PlaybookVideo[]>) {
      const next = action.payload ?? [];
      if (next.length === 0) return;
      const prev = Array.isArray(state.playbookData?.videos) ? state.playbookData!.videos! : [];
      state.playbookData = { ...(state.playbookData ?? {}), videos: [...prev, ...next] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    updatePlaybookVideo(
      state,
      action: PayloadAction<{ id: number; changes: Partial<PlaybookVideo> }>,
    ) {
      const list = Array.isArray(state.playbookData?.videos) ? state.playbookData!.videos! : [];
      const idx = list.findIndex((v) => Number(v?.id) === Number(action.payload.id));
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...action.payload.changes };
      state.playbookData = { ...(state.playbookData ?? {}), videos: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    updatePlaybookHoldImage(
      state,
      action: PayloadAction<{ id: number; changes: Partial<PlaybookHoldImage> }>,
    ) {
      const list = Array.isArray(state.playbookData?.holdImages) ? state.playbookData!.holdImages! : [];
      const idx = list.findIndex((h) => Number(h?.id) === Number(action.payload.id));
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...action.payload.changes };
      state.playbookData = { ...(state.playbookData ?? {}), holdImages: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    setProjectorMediaLibrary(
      state,
      action: PayloadAction<{ videos: PlaybookVideo[]; holdImages: PlaybookHoldImage[] }>,
    ) {
      state.playbookData = {
        ...(state.playbookData ?? {}),
        videos: action.payload.videos,
        holdImages: action.payload.holdImages,
      };
      state.playbookDataRevision += 1;
    },
    removePlaybookVideo(state, action: PayloadAction<number>) {
      const id = Number(action.payload);
      const prev = Array.isArray(state.playbookData?.videos) ? state.playbookData!.videos! : [];
      const next = prev.filter((v) => Number(v?.id) !== id);
      if (next.length === prev.length) return;
      state.playbookData = { ...(state.playbookData ?? {}), videos: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    removePlaybookHoldImage(state, action: PayloadAction<number>) {
      const id = Number(action.payload);
      const prev = Array.isArray(state.playbookData?.holdImages) ? state.playbookData!.holdImages! : [];
      const removed = prev.find((h) => Number(h?.id) === id);
      const next = prev.filter((h) => Number(h?.id) !== id);
      if (next.length === prev.length) return;

      const prevProjector = state.playbookData?.projector;
      let projector: SceneProjectorSettingsV1 | undefined = prevProjector
        ? { ...prevProjector }
        : undefined;

      if (projector) {
        const defaultId = Number(projector.defaultHoldId);
        if (defaultId === id || !next.some((h) => Number(h.id) === defaultId)) {
          projector.defaultHoldId = next[0]?.id;
        }
        const removedKey = String(removed?.remoteKey ?? "").trim();
        const legacyKey = String(projector.holdImageRemoteKey ?? "").trim();
        if (
          removedKey &&
          (legacyKey === removedKey ||
            String(projector.holdImageFile ?? "").trim() === String(removed?.file ?? "").trim())
        ) {
          delete projector.holdImageFile;
          delete projector.holdImageRemoteKey;
          delete projector.holdImageRemoteUrl;
          delete projector.holdImageFilePath;
        }
        if (next.length === 0) {
          delete projector.defaultHoldId;
        }
      }

      state.playbookData = {
        ...(state.playbookData ?? {}),
        holdImages: next,
        ...(projector ? { projector: { ...projector, v: 1 } } : {}),
      };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
    setProjectorSettings(state, action: PayloadAction<SceneProjectorSettingsV1>) {
      state.playbookData = { ...(state.playbookData ?? {}), projector: action.payload };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    },
  },
  extraReducers: attachPlaybookThunkExtraReducers,
});

export const playbookActions = playbookSlice.actions;
export const playbookReducer = playbookSlice.reducer;

export * from "./playbook-types";
export * from "./playbook-thunks";