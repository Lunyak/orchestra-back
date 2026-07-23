import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppDispatch } from "../../../shared/store/store";
import { playbookActions } from "../../playbook/model/playbook-slice";
import type { PlaybookData } from "../../playbook/model/playbook-types";
import { applyKadrProjector, showProjectorHold } from "./apply-kadr-projector";
import {
  closeProjectorWindow,
  ensureProjectorOutputOpen,
  isProjectorWindowOpen,
  notifyProjectorReady,
  openProjectorWindow,
  pauseProjectorVideo,
  pingProjectorOutput,
  resumeProjectorVideo,
  seekProjectorVideo,
  sendProjectorVideoMuted,
  sendProjectorVideoVolume,
  subscribeProjectorOutputErrors,
  subscribeProjectorPlayback,
} from "../../projector/model/projector-playback-bridge";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import { normalizeHoldImages } from "../../projector/model/playbook-projector-persist";
import {
  resolveKadrProjectorVideoOptions,
  type KadrProjectorCue,
} from "../../theater/model/kadr-projector";

export type UseSpectacleRunProjectorArgs = {
  projectName: string;
  playbookData: PlaybookData | null | undefined;
  dispatch: AppDispatch;
  setLiveStatus: (message: string | null) => void;
};

export function useSpectacleRunProjector({
  projectName,
  playbookData,
  dispatch,
  setLiveStatus,
}: UseSpectacleRunProjectorArgs) {
  const [isProjectorOpen, setIsProjectorOpen] = useState(() => isProjectorWindowOpen());
  const [projectorDraft, setProjectorDraft] = useState<KadrProjectorCue>({ mode: "hold" });
  const [projectorPlayback, setProjectorPlayback] = useState<{
    videoId: number | null;
    holdId: number | null;
    playing: boolean;
    mode: "video" | "hold" | "black";
    currentTime: number;
    duration: number;
    volume: number;
  }>({
    videoId: null,
    holdId: null,
    playing: false,
    mode: "black",
    currentTime: 0,
    duration: 0,
    volume: 1,
  });
  const [projectorVideoMuted, setProjectorVideoMuted] = useState<Record<number, boolean>>({});
  const [projectorVideoVolume, setProjectorVideoVolume] = useState<Record<number, number>>({});

  const projectorMediaCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: projectName,
      videos: playbookData?.videos ?? [],
      holdImages: playbookData?.holdImages ?? [],
      projector: playbookData?.projector ?? null,
    }),
    [projectName, playbookData?.holdImages, playbookData?.projector, playbookData?.videos],
  );

  const videos = projectorMediaCtx.videos ?? [];
  const holdImages = useMemo(
    () =>
      normalizeHoldImages(
        playbookData?.holdImages,
        playbookData?.projector ?? undefined,
      ),
    [playbookData?.holdImages, playbookData?.projector],
  );

  useEffect(() => {
    const unsubReady = notifyProjectorReady();
    const unsubPlayback = subscribeProjectorPlayback((state) => {
      setProjectorPlayback({
        videoId: state.videoId,
        holdId: state.holdId,
        playing: state.playing,
        mode: state.mode,
        currentTime: state.currentTime ?? 0,
        duration: state.duration ?? 0,
        volume: state.volume ?? 1,
      });
    });
    const unsubErrors = subscribeProjectorOutputErrors((error) => {
      const label = error.scope === "hold" ? "заставку" : "видео";
      setLiveStatus(`Проектор: не удалось показать ${label} — ${error.message}`);
    });
    void pingProjectorOutput().then((alive) => {
      if (alive) setIsProjectorOpen(true);
    });
    return () => {
      unsubReady();
      unsubPlayback();
      unsubErrors();
    };
  }, [setLiveStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsProjectorOpen(isProjectorWindowOpen());
    }, 800);
    return () => window.clearInterval(timer);
  }, []);

  const openProjector = useCallback(() => {
    const win = openProjectorWindow();
    if (!win) {
      setLiveStatus("Браузер заблокировал окно — разрешите всплывающие окна");
      return;
    }
    setIsProjectorOpen(true);
    void showProjectorHold(projectorMediaCtx);
    setLiveStatus("Проектор открыт — перенесите окно на второй экран и нажмите F11");
  }, [projectorMediaCtx, setLiveStatus]);

  const closeProjector = useCallback(() => {
    closeProjectorWindow();
    setIsProjectorOpen(false);
    setProjectorPlayback({
      videoId: null,
      holdId: null,
      playing: false,
      mode: "black",
      currentTime: 0,
      duration: 0,
      volume: 1,
    });
    setLiveStatus("Проектор закрыт");
  }, [setLiveStatus]);

  const ensureProjectorOpen = useCallback(async (): Promise<boolean> => {
    const open = await ensureProjectorOutputOpen({ focus: false });
    if (open) {
      setIsProjectorOpen(true);
      return true;
    }
    setLiveStatus("Браузер заблокировал окно — разрешите всплывающие окна");
    return false;
  }, [setLiveStatus]);

  const resolveProjectorVideoMuted = useCallback(
    (videoId: number) => projectorVideoMuted[Number(videoId)] ?? false,
    [projectorVideoMuted],
  );

  const resolveProjectorVideoVolume = useCallback(
    (videoId: number) => {
      const stored = projectorVideoVolume[Number(videoId)];
      if (stored != null && Number.isFinite(stored)) return Math.max(0, Math.min(1, stored));
      return resolveProjectorVideoMuted(videoId) ? 0 : 1;
    },
    [projectorVideoMuted, projectorVideoVolume],
  );

  const playProjectorCue = useCallback(
    async (cue: KadrProjectorCue, statusLabel?: string) => {
      setProjectorDraft(cue);
      if (!(await ensureProjectorOpen())) return;
      await applyKadrProjector(
        cue,
        projectorMediaCtx,
        resolveKadrProjectorVideoOptions(cue, {
          resolveMuted: resolveProjectorVideoMuted,
          resolveVolume: resolveProjectorVideoVolume,
        }),
      );
      const holdLabel =
        cue.mode === "hold" && cue.holdId != null
          ? holdImages.find((h) => Number(h.id) === cue.holdId)?.title?.trim() ||
            `заставка ${cue.holdId}`
          : "заставка";
      setLiveStatus(
        statusLabel ??
          (cue.mode === "hold"
            ? `Проектор: ${holdLabel} — окно на втором экране, F11 для полного экрана`
            : "Проектор: видео — окно на втором экране, F11 для полного экрана"),
      );
    },
    [
      ensureProjectorOpen,
      holdImages,
      projectorMediaCtx,
      resolveProjectorVideoMuted,
      resolveProjectorVideoVolume,
      setLiveStatus,
    ],
  );

  const playProjectorVideo = useCallback(
    (videoId: number) => {
      const video = videos.find((v) => Number(v.id) === Number(videoId));
      const label = video?.title?.trim() || `видео ${videoId}`;
      void playProjectorCue(
        { mode: "video", videoId },
        `▶ ${label} — на проекторе. Перенесите окно на 2-й экран, F11`,
      );
    },
    [playProjectorCue, videos],
  );

  const toggleProjectorVideo = useCallback(
    (videoId: number) => {
      const id = Number(videoId);
      if (
        projectorPlayback.videoId === id &&
        projectorPlayback.playing &&
        isProjectorWindowOpen()
      ) {
        pauseProjectorVideo();
        const video = videos.find((v) => Number(v.id) === id);
        const label = video?.title?.trim() || `видео ${id}`;
        setLiveStatus(`⏸ ${label} — пауза на проекторе`);
        return;
      }
      if (
        projectorPlayback.videoId === id &&
        !projectorPlayback.playing &&
        isProjectorWindowOpen()
      ) {
        resumeProjectorVideo();
        const video = videos.find((v) => Number(v.id) === id);
        const label = video?.title?.trim() || `видео ${id}`;
        setLiveStatus(`▶ ${label} — продолжение на проекторе`);
        return;
      }
      playProjectorVideo(id);
    },
    [playProjectorVideo, projectorPlayback.playing, projectorPlayback.videoId, setLiveStatus, videos],
  );

  const toggleProjectorVideoMute = useCallback(
    (videoId: number) => {
      const id = Number(videoId);
      const nextMuted = !resolveProjectorVideoMuted(id);
      const nextVolume = nextMuted ? 0 : resolveProjectorVideoVolume(id) || 1;
      setProjectorVideoMuted((prev) => ({ ...prev, [id]: nextMuted }));
      setProjectorVideoVolume((prev) => ({ ...prev, [id]: nextVolume }));
      if (projectorPlayback.videoId === id && isProjectorWindowOpen()) {
        sendProjectorVideoMuted(nextMuted);
        sendProjectorVideoVolume(nextVolume);
      }
      const video = videos.find((v) => Number(v.id) === id);
      const label = video?.title?.trim() || `видео ${id}`;
      setLiveStatus(nextMuted ? `🔇 ${label} — звук выключен` : `🔊 ${label} — звук включён`);
    },
    [
      projectorPlayback.videoId,
      resolveProjectorVideoMuted,
      resolveProjectorVideoVolume,
      setLiveStatus,
      videos,
    ],
  );

  const setProjectorVideoVolumeLevel = useCallback(
    (videoId: number, volume: number) => {
      const id = Number(videoId);
      const nextVolume = Math.max(0, Math.min(1, volume));
      const nextMuted = nextVolume === 0;
      setProjectorVideoVolume((prev) => ({ ...prev, [id]: nextVolume }));
      setProjectorVideoMuted((prev) => ({ ...prev, [id]: nextMuted }));
      if (projectorPlayback.videoId === id && isProjectorWindowOpen()) {
        sendProjectorVideoVolume(nextVolume);
        if (nextMuted) sendProjectorVideoMuted(true);
      }
    },
    [projectorPlayback.videoId],
  );

  const seekProjectorVideoTime = useCallback((time: number) => {
    if (!isProjectorWindowOpen()) return;
    seekProjectorVideo(Math.max(0, time));
  }, []);

  const resetProjectorDraftAfterRemoval = useCallback(
    (removed: { kind: "video"; id: number } | { kind: "hold"; id: number }) => {
      if (removed.kind === "video") {
        if (projectorDraft.mode === "video" && Number(projectorDraft.videoId) === removed.id) {
          const nextHold = holdImages[0];
          setProjectorDraft(
            nextHold ? { mode: "hold", holdId: nextHold.id } : { mode: "hold" },
          );
        }
        if (projectorPlayback.videoId === removed.id && isProjectorWindowOpen()) {
          void showProjectorHold(projectorMediaCtx);
        }
        return;
      }
      if (
        projectorDraft.mode === "hold" &&
        (projectorDraft.holdId == null || Number(projectorDraft.holdId) === removed.id)
      ) {
        const nextHold = holdImages.find((h) => Number(h.id) !== removed.id);
        setProjectorDraft(
          nextHold ? { mode: "hold", holdId: nextHold.id } : { mode: "hold" },
        );
      }
      if (
        projectorPlayback.mode === "hold" &&
        projectorPlayback.holdId === removed.id &&
        isProjectorWindowOpen()
      ) {
        const nextHold = holdImages.find((h) => Number(h.id) !== removed.id);
        if (nextHold) {
          void showProjectorHold(projectorMediaCtx, nextHold.id);
        } else {
          closeProjector();
        }
      }
    },
    [
      closeProjector,
      holdImages,
      projectorDraft,
      projectorMediaCtx,
      projectorPlayback.holdId,
      projectorPlayback.mode,
      projectorPlayback.videoId,
    ],
  );

  const removeProjectorVideo = useCallback(
    (videoId: number) => {
      dispatch(playbookActions.removePlaybookVideo(videoId));
      resetProjectorDraftAfterRemoval({ kind: "video", id: videoId });
    },
    [dispatch, resetProjectorDraftAfterRemoval],
  );

  const removeProjectorHold = useCallback(
    (holdId: number) => {
      dispatch(playbookActions.removePlaybookHoldImage(holdId));
      resetProjectorDraftAfterRemoval({ kind: "hold", id: holdId });
    },
    [dispatch, resetProjectorDraftAfterRemoval],
  );

  return {
    projectorDraft,
    setProjectorDraft,
    projectorMediaCtx,
    videos,
    holdImages,
    isProjectorOpen,
    openProjector,
    closeProjector,
    ensureProjectorOpen,
    resolveProjectorVideoMuted,
    resolveProjectorVideoVolume,
    playProjectorCue,
    playProjectorVideo,
    toggleProjectorVideo,
    toggleProjectorVideoMute,
    setProjectorVideoVolumeLevel,
    seekProjectorVideoTime,
    removeProjectorVideo,
    removeProjectorHold,
    projectorPlayback,
  };
}
