import { useCallback, useEffect, useRef, useState } from "react";
import { resolveProjectorOutputMediaSrc } from "../model/resolve-projector-output-media";
import { normalizeProjectorTransitionMs } from "../model/projector-video-preview";
import {
  sendProjectorMessage,
  subscribeProjectorMessages,
  type ProjectorMessage,
} from "../model/projector-playback-bridge";
import "./projector-output.css";

type OutputMode = "black" | "hold" | "video";

type PendingHold = {
  storageKey: string | null;
  fallbackSrc: string | null;
  fileName: string | null;
  projectSlug: string | null;
};

const FADE_BUCKETS_MS = [
  50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 750, 800, 900, 1000,
  1200, 1500,
] as const;

function toFadeBucketMs(fadeMs: number): number {
  const normalized = normalizeProjectorTransitionMs(fadeMs);
  if (normalized <= 0) return 0;
  let best: (typeof FADE_BUCKETS_MS)[number] = FADE_BUCKETS_MS[0];
  for (const bucket of FADE_BUCKETS_MS) {
    if (Math.abs(bucket - normalized) < Math.abs(best - normalized)) {
      best = bucket;
    }
  }
  return best;
}

function reportPlayback(
  videoId: number | null,
  holdId: number | null,
  playing: boolean,
  mode: OutputMode,
  video?: HTMLVideoElement | null,
) {
  const currentTime = mode === "video" && video ? video.currentTime : 0;
  const duration = mode === "video" && video && Number.isFinite(video.duration) ? video.duration : 0;
  const volume = mode === "video" && video ? video.volume : 1;
  sendProjectorMessage({
    type: "playback-state",
    videoId,
    holdId,
    playing,
    mode,
    currentTime,
    duration,
    volume,
  });
}

function reportOutputError(scope: "hold" | "video", message: string) {
  sendProjectorMessage({ type: "output-error", scope, message });
}

export function ProjectorOutputPage() {
  const [mode, setMode] = useState<OutputMode>("black");
  const [holdSrc, setHoldSrc] = useState<string | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [outputHint, setOutputHint] = useState<string | null>(null);
  const [mediaHidden, setMediaHidden] = useState(false);
  const [fadeBucketMs, setFadeBucketMs] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeVideoIdRef = useRef<number | null>(null);
  const activeHoldIdRef = useRef<number | null>(null);
  const holdBlobRef = useRef<string | null>(null);
  const videoBlobRef = useRef<string | null>(null);
  const pendingHoldRef = useRef<PendingHold>({
    storageKey: null,
    fallbackSrc: null,
    fileName: null,
    projectSlug: null,
  });
  const loadHoldSeqRef = useRef(0);
  const loadVideoSeqRef = useRef(0);
  const videoVolumeRef = useRef(1);
  const videoMutedRef = useRef(false);
  const fadeTokenRef = useRef(0);

  const requestPresentationMode = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    try {
      window.moveTo(0, 0);
      window.resizeTo(window.screen.availWidth, window.screen.availHeight);
    } catch {
      // Браузер может запретить изменение геометрии окна.
    }

    if (document.fullscreenElement === el) return;
    void el.requestFullscreen?.().catch(() => {
      // Браузер может отклонить без жеста — оператор кликнет по экрану.
    });
  }, []);

  const revokeHoldBlob = useCallback(() => {
    if (holdBlobRef.current) {
      URL.revokeObjectURL(holdBlobRef.current);
      holdBlobRef.current = null;
    }
  }, []);

  const revokeVideoBlob = useCallback(() => {
    if (videoBlobRef.current) {
      URL.revokeObjectURL(videoBlobRef.current);
      videoBlobRef.current = null;
    }
  }, []);

  const loadHoldImage = useCallback(
    async (pending: PendingHold) => {
      const seq = loadHoldSeqRef.current + 1;
      loadHoldSeqRef.current = seq;
      revokeHoldBlob();
      setHoldSrc(null);
      setHoldLoading(true);
      setOutputHint(null);

      try {
        const resolved = await resolveProjectorOutputMediaSrc({
          kind: "image",
          storageKey: pending.storageKey,
          src: pending.fallbackSrc,
          fileName: pending.fileName,
          projectSlug: pending.projectSlug,
        });
        if (loadHoldSeqRef.current !== seq) return;
        if (resolved) {
          if (resolved.from === "storageKey") {
            holdBlobRef.current = resolved.src;
          }
          setHoldSrc(resolved.src);
          return;
        }
        reportOutputError(
          "hold",
          "файл заставки не найден — перезагрузите заставку в панели проектора",
        );
        setOutputHint("Заставка не найдена — нажмите «Выбрать папку…» в Суфлере");
      } finally {
        if (loadHoldSeqRef.current === seq) {
          setHoldLoading(false);
        }
      }
    },
    [revokeHoldBlob],
  );

  const loadVideoSource = useCallback(
    async (input: PendingHold) => {
      const seq = loadVideoSeqRef.current + 1;
      loadVideoSeqRef.current = seq;
      revokeVideoBlob();
      setVideoSrc(null);
      setVideoLoading(true);
      setOutputHint(null);

      try {
        const resolved = await resolveProjectorOutputMediaSrc({
          kind: "video",
          storageKey: input.storageKey,
          src: input.fallbackSrc,
          fileName: input.fileName,
          projectSlug: input.projectSlug,
        });
        if (loadVideoSeqRef.current !== seq) return;
        if (resolved) {
          if (resolved.from === "storageKey") {
            videoBlobRef.current = resolved.src;
          }
          setVideoSrc(resolved.src);
          return;
        }
        reportOutputError(
          "video",
          "файл видео не найден — перезагрузите видео в панели проектора",
        );
        setOutputHint("Видео не найдено — нажмите «Выбрать папку…» в Суфлере");
      } finally {
        if (loadVideoSeqRef.current === seq) {
          setVideoLoading(false);
        }
      }
    },
    [revokeVideoBlob],
  );

  const applyVideoElementState = useCallback((video: HTMLVideoElement) => {
    const volume = Math.max(0, Math.min(1, videoVolumeRef.current));
    video.volume = volume;
    video.muted = videoMutedRef.current || volume === 0;
  }, []);

  const runWithFade = useCallback(
    async (fadeMs: number | undefined, apply: () => void | Promise<void>) => {
      const bucket = toFadeBucketMs(fadeMs ?? 0);
      const token = fadeTokenRef.current + 1;
      fadeTokenRef.current = token;

      if (bucket <= 0) {
        setFadeBucketMs(0);
        setMediaHidden(false);
        await apply();
        return;
      }

      const half = Math.max(50, Math.round(bucket / 2));
      setFadeBucketMs(half);
      setMediaHidden(true);
      await new Promise((resolve) => window.setTimeout(resolve, half));
      if (fadeTokenRef.current !== token) return;
      await apply();
      if (fadeTokenRef.current !== token) return;
      window.requestAnimationFrame(() => {
        if (fadeTokenRef.current !== token) return;
        setMediaHidden(false);
      });
    },
    [],
  );

  const applyMessage = useCallback(
    (msg: ProjectorMessage) => {
      if (msg.type === "ping") {
        sendProjectorMessage({ type: "pong" });
        return;
      }
      if (msg.type === "set-video-volume") {
        videoVolumeRef.current = Math.max(0, Math.min(1, Number(msg.volume) || 0));
        const video = videoRef.current;
        if (video) {
          applyVideoElementState(video);
          reportPlayback(
            activeVideoIdRef.current,
            activeHoldIdRef.current,
            !video.paused,
            "video",
            video,
          );
        }
        return;
      }
      if (msg.type === "seek-video") {
        const video = videoRef.current;
        if (video && Number.isFinite(msg.time)) {
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          video.currentTime = Math.max(0, Math.min(duration, msg.time));
          reportPlayback(
            activeVideoIdRef.current,
            activeHoldIdRef.current,
            !video.paused,
            "video",
            video,
          );
        }
        return;
      }
      if (msg.type === "set-video-muted") {
        videoMutedRef.current = msg.muted;
        const video = videoRef.current;
        if (video) applyVideoElementState(video);
        return;
      }
      if (msg.type === "pause-video") {
        const video = videoRef.current;
        if (video && !video.paused) {
          video.pause();
        }
        return;
      }
      if (msg.type === "resume-video") {
        const video = videoRef.current;
        if (video && video.paused) {
          void video.play().catch(() => undefined);
        }
        return;
      }
      if (msg.type === "black") {
        void runWithFade(msg.fadeMs, () => {
          activeVideoIdRef.current = null;
          activeHoldIdRef.current = null;
          setMode("black");
          setVideoSrc(null);
          setHoldSrc(null);
          setHoldLoading(false);
          setVideoLoading(false);
          revokeHoldBlob();
          revokeVideoBlob();
          reportPlayback(null, null, false, "black");
        });
        return;
      }
      if (msg.type === "show-hold") {
        void runWithFade(msg.fadeMs, () => {
          activeVideoIdRef.current = null;
          activeHoldIdRef.current = msg.holdId;
          const pending: PendingHold = {
            storageKey: msg.storageKey,
            fallbackSrc: msg.src,
            fileName: msg.fileName ?? null,
            projectSlug: msg.projectSlug ?? null,
          };
          pendingHoldRef.current = pending;
          setMode("hold");
          setVideoSrc(null);
          revokeVideoBlob();
          void loadHoldImage(pending);
          reportPlayback(null, msg.holdId, false, "hold");
          requestPresentationMode();
        });
        return;
      }
      if (msg.type === "show-video") {
        void runWithFade(msg.fadeMs, () => {
          activeVideoIdRef.current = msg.videoId;
          activeHoldIdRef.current = msg.holdId;
          videoMutedRef.current = msg.muted ?? false;
          videoVolumeRef.current =
            msg.volume != null && Number.isFinite(msg.volume)
              ? Math.max(0, Math.min(1, msg.volume))
              : videoMutedRef.current
                ? 0
                : 1;
          pendingHoldRef.current = {
            storageKey: msg.holdStorageKey,
            fallbackSrc: msg.holdSrc,
            fileName: msg.holdFileName ?? null,
            projectSlug: msg.projectSlug ?? null,
          };
          setMode("video");
          setHoldSrc(null);
          revokeHoldBlob();
          void loadVideoSource({
            storageKey: msg.storageKey,
            fallbackSrc: msg.src || null,
            fileName: msg.fileName ?? null,
            projectSlug: msg.projectSlug ?? null,
          });
          requestPresentationMode();
        });
      }
    },
    [
      applyVideoElementState,
      loadHoldImage,
      loadVideoSource,
      requestPresentationMode,
      revokeHoldBlob,
      revokeVideoBlob,
      runWithFade,
    ],
  );

  useEffect(() => {
    const unsub = subscribeProjectorMessages(applyMessage);
    sendProjectorMessage({ type: "ready" });
    requestPresentationMode();
    return () => {
      unsub();
      revokeHoldBlob();
      revokeVideoBlob();
    };
  }, [applyMessage, requestPresentationMode, revokeHoldBlob, revokeVideoBlob]);

  useEffect(() => {
    if (mode !== "video" || !videoSrc || videoLoading) return;
    const video = videoRef.current;
    if (!video) return;
    applyVideoElementState(video);
    video.load();
    const play = () => {
      void video.play().catch(() => {
        reportOutputError(
          "video",
          "браузер не запустил видео — кликните по экрану проектора",
        );
        reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, false, "video", video);
      });
    };
    video.addEventListener("loadeddata", play);
    play();
    return () => video.removeEventListener("loadeddata", play);
  }, [applyVideoElementState, mode, videoSrc, videoLoading]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || mode !== "video") return;
    reportPlayback(
      activeVideoIdRef.current,
      activeHoldIdRef.current,
      !video.paused,
      "video",
      video,
    );
  }, [mode]);

  const handleVideoPlay = useCallback(() => {
    reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, true, "video", videoRef.current);
  }, []);

  const handleVideoPause = useCallback(() => {
    if (mode === "video") {
      reportPlayback(
        activeVideoIdRef.current,
        activeHoldIdRef.current,
        false,
        "video",
        videoRef.current,
      );
    }
  }, [mode]);

  const handleVideoEnded = useCallback(() => {
    activeVideoIdRef.current = null;
    setMode("hold");
    setVideoSrc(null);
    revokeVideoBlob();
    const pending = pendingHoldRef.current;
    void loadHoldImage(pending);
    reportPlayback(null, activeHoldIdRef.current, false, "hold");
  }, [loadHoldImage, revokeVideoBlob]);

  const handleVideoError = useCallback(() => {
    reportOutputError(
      "video",
      "не удалось воспроизвести видео — проверьте файл и перезагрузите страницу проектора",
    );
    reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, false, "video", videoRef.current);
  }, []);

  const handleHoldError = useCallback(() => {
    reportOutputError(
      "hold",
      "не удалось показать заставку — перезагрузите файл в панели проектора",
    );
    setHoldSrc(null);
    revokeHoldBlob();
    reportPlayback(null, activeHoldIdRef.current, false, "hold");
  }, [revokeHoldBlob]);

  const handleRootClick = useCallback(() => {
    requestPresentationMode();
    const video = videoRef.current;
    if (video && video.paused) void video.play().catch(() => undefined);
  }, [requestPresentationMode]);

  return (
    <div
      ref={rootRef}
      className="projector-output"
      data-media-hidden={mediaHidden ? "true" : undefined}
      data-fade-ms={fadeBucketMs > 0 ? String(fadeBucketMs) : undefined}
      onClick={handleRootClick}
      role="presentation"
    >
      <div className="projector-output__stage">
        {mode === "hold" && holdSrc ? (
          <img
            className="projector-output__media"
            src={holdSrc}
            alt=""
            draggable={false}
            onError={handleHoldError}
          />
        ) : null}

        {mode === "video" && videoSrc ? (
          <video
            ref={videoRef}
            className="projector-output__media"
            src={videoSrc}
            autoPlay
            playsInline
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
          />
        ) : null}
      </div>

      {!holdLoading && !videoLoading && outputHint ? (
        <p className="projector-output__error">{outputHint}</p>
      ) : null}
    </div>
  );
}
