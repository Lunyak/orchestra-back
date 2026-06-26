import type { ActionReducerMapBuilder, PayloadAction } from "@reduxjs/toolkit";
import type {
  PlaybookState,
  SceneSound,
  SceneVoiceLineEntry,
} from "./playbook-types";
import {
  addScenePlaylistTracksFromPathsDesktop,
  deleteScenePlaylistTrackDesktop,
  persistScenePlaylistDesktop,
  pickScenePlaylistTracksDesktop,
  pickSceneSoundsDesktop,
  setSoundIcon,
  uploadPlaybookHoldImagesWeb,
  uploadPlaybookVideosWeb,
  uploadScenePlaylistWeb,
  uploadSceneSoundsWeb,
  uploadVoiceLineTakeWeb,
} from "./playbook-thunks";

export function attachPlaybookThunkExtraReducers(builder: ActionReducerMapBuilder<PlaybookState>) {
    const pending = (state: PlaybookState) => {
      state.soundsUpload.uploading = true;
      state.soundsUpload.error = null;
    };
    const fulfilled = (state: PlaybookState, action: PayloadAction<{ sounds: SceneSound[] }>) => {
      state.soundsUpload.uploading = false;
      state.soundsUpload.error = null;
      const next = action.payload?.sounds ?? [];
      if (next.length === 0) return;
      const prev = (state.playbookData as any)?.sounds;
      const prevList = Array.isArray(prev) ? prev : [];
      state.playbookData = { ...(state.playbookData ?? {}), sounds: [...prevList, ...next] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    };
    const rejected = (state: PlaybookState, action: any) => {
      state.soundsUpload.uploading = false;
      state.soundsUpload.error =
        action?.error?.message ?? "Не удалось загрузить звуки";
    };

    builder.addCase(uploadSceneSoundsWeb.pending, pending);
    builder.addCase(uploadSceneSoundsWeb.fulfilled, fulfilled);
    builder.addCase(uploadSceneSoundsWeb.rejected, rejected);

    builder.addCase(pickSceneSoundsDesktop.pending, pending);
    builder.addCase(pickSceneSoundsDesktop.fulfilled, fulfilled);
    builder.addCase(pickSceneSoundsDesktop.rejected, rejected);

    builder.addCase(uploadScenePlaylistWeb.pending, (state) => {
      state.playlistUpload.uploading = true;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(uploadScenePlaylistWeb.rejected, (state, action: any) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось загрузить треки");
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(uploadScenePlaylistWeb.fulfilled, (state, action) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
      const next = action.payload?.playlist ?? [];
      if (next.length === 0) return;
      const prev = Array.isArray(state.playbookData?.playlist) ? state.playbookData!.playlist! : [];
      state.playbookData = { ...(state.playbookData ?? {}), playlist: [...prev, ...next] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(setSoundIcon.fulfilled, (state, action) => {
      const { soundId, changes } = action.payload;
      if (!changes || Object.keys(changes).length === 0) return;
      const listRaw = (state.playbookData as any)?.sounds;
      const list = Array.isArray(listRaw) ? listRaw : [];
      const idx = list.findIndex((s: any) => Number(s?.id) === soundId);
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...changes };
      state.playbookData = { ...(state.playbookData ?? {}), sounds: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(pickScenePlaylistTracksDesktop.pending, (state) => {
      state.playlistUpload.uploading = true;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(pickScenePlaylistTracksDesktop.rejected, (state, action: any) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось добавить треки");
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(pickScenePlaylistTracksDesktop.fulfilled, (state, action) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
      state.playbookData = { ...(state.playbookData ?? {}), playlist: action.payload.playlist ?? [] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(addScenePlaylistTracksFromPathsDesktop.pending, (state) => {
      state.playlistUpload.uploading = true;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(addScenePlaylistTracksFromPathsDesktop.rejected, (state, action: any) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось добавить треки");
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(addScenePlaylistTracksFromPathsDesktop.fulfilled, (state, action) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
      state.playbookData = { ...(state.playbookData ?? {}), playlist: action.payload.playlist ?? [] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(persistScenePlaylistDesktop.pending, (state) => {
      // do not block UI, but expose error if needed
      state.playlistUpload.error = null;
    });
    builder.addCase(persistScenePlaylistDesktop.rejected, (state, action: any) => {
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось сохранить плейлист");
    });

    builder.addCase(deleteScenePlaylistTrackDesktop.pending, (state) => {
      state.playlistUpload.error = null;
    });
    builder.addCase(deleteScenePlaylistTrackDesktop.rejected, (state, action: any) => {
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось удалить трек");
    });
    builder.addCase(deleteScenePlaylistTrackDesktop.fulfilled, (state, action) => {
      const list = Array.isArray(state.playbookData?.playlist) ? state.playbookData!.playlist! : [];
      const next = list.filter((t) => Number(t.id) !== Number(action.payload.removedId));
      state.playbookData = { ...(state.playbookData ?? {}), playlist: next };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(uploadVoiceLineTakeWeb.pending, (state) => {
      state.voiceLinesUpload = { uploading: true, error: null };
    });
    builder.addCase(uploadVoiceLineTakeWeb.rejected, (state, action: any) => {
      state.voiceLinesUpload = {
        uploading: false,
        error: String(action?.error?.message ?? "Не удалось загрузить дубль"),
      };
    });
    builder.addCase(uploadPlaybookVideosWeb.fulfilled, (state, action) => {
      const next = action.payload?.videos ?? [];
      if (next.length === 0) return;
      const prev = Array.isArray(state.playbookData?.videos) ? state.playbookData!.videos! : [];
      state.playbookData = { ...(state.playbookData ?? {}), videos: [...prev, ...next] };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(uploadPlaybookHoldImagesWeb.fulfilled, (state, action) => {
      const added = action.payload?.holdImages ?? [];
      if (added.length === 0) return;
      const prev = Array.isArray(state.playbookData?.holdImages) ? state.playbookData!.holdImages! : [];
      const next = [...prev, ...added];
      const prevProjector = state.playbookData?.projector;
      const defaultHoldId =
        prevProjector?.defaultHoldId != null
          ? prevProjector.defaultHoldId
          : next[0]?.id;
      state.playbookData = {
        ...(state.playbookData ?? {}),
        holdImages: next,
        projector: { v: 1, ...prevProjector, defaultHoldId },
      };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });

    builder.addCase(uploadVoiceLineTakeWeb.fulfilled, (state, action) => {
      state.voiceLinesUpload = { uploading: false, error: null };
      const { lineId, role, roleKey, performerId, take } = action.payload;

      const prev = state.playbookData?.voiceLines;
      const byLineId = prev?.byLineId ?? {};
      const existing = byLineId[lineId];

      const prevTakesByPerformer = existing?.takesByPerformer ?? {};
      const nextList = [...(prevTakesByPerformer[performerId] ?? []), take];
      const nextTakesByPerformer = {
        ...prevTakesByPerformer,
        [performerId]: nextList,
      };

      const nextPreferred = {
        ...(existing?.preferredTakeIdByPerformer ?? {}),
        [performerId]: take.id,
      };

      const nextEntry: SceneVoiceLineEntry = {
        lineId,
        role: existing?.role ?? role,
        roleKey: existing?.roleKey ?? roleKey,
        takesByPerformer: nextTakesByPerformer,
        preferredTakeIdByPerformer: nextPreferred,
      };

      state.playbookData = {
        ...(state.playbookData ?? {}),
        voiceLines: {
          version: 1,
          byLineId: {
            ...byLineId,
            [lineId]: nextEntry,
          },
        },
      };
      state.hasLocalEdits = true;
      state.playbookDataRevision += 1;
    });
}