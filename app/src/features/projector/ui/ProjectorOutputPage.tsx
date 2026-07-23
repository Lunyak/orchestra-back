import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProjectorImageBlobUrl,
  fetchProjectorVideoBlobUrl,
} from "../model/projector-media";
import { isLocalProjectMediaUrl } from "../../../shared/platform/media-url";
import {
  sendProjectorMessage,
  subscribeProjectorMessages,
  type ProjectorMessage,
} from "../model/projector-playback-bridge";
import "./projector-output.css";

type OutputMode = "black" | "hold" | "video";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeVideoIdRef = useRef<number | null>(null);
  const activeHoldIdRef = useRef<number | null>(null);
  const holdBlobRef = useRef<string | null>(null);
  const videoBlobRef = useRef<string | null>(null);
  const pendingHoldRef = useRef<{ storageKey: string | null; fallbackSrc: string | null }>({
    storageKey: null,
    fallbackSrc: null,
  });
  const loadHoldSeqRef = useRef(0);
  const loadVideoSeqRef = useRef(0);
  const videoVolumeRef = useRef(1);
  const videoMutedRef = useRef(false);

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
    async (storageKey: string | null, fallbackSrc: string | null) => {
      const seq = loadHoldSeqRef.current + 1;
      loadHoldSeqRef.current = seq;
      revokeHoldBlob();
      setHoldSrc(null);
      setHoldLoading(true);
      setOutputHint(null);

      try {
        if (fallbackSrc && isLocalProjectMediaUrl(fallbackSrc)) {
          setHoldSrc(fallbackSrc);
          return;
        }
        if (fallbackSrc) {
          setHoldSrc(fallbackSrc);
          return;
        }
        if (storageKey) {
          const blobUrl = await fetchProjectorImageBlobUrl(storageKey);
          if (loadHoldSeqRef.current !== seq) return;
          if (blobUrl) {
            holdBlobRef.current = blobUrl;
            setHoldSrc(blobUrl);
            return;
          }
        }
        reportOutputError(
          "hold",
          "файл заставки не найден в хранилище — перезагрузите заставку в панели проектора",
        );
        setOutputHint("Заставка не найдена — нажмите «Выбрать папку…» в Прогоне");
      } finally {
        if (loadHoldSeqRef.current === seq) {
          setHoldLoading(false);
        }
      }
    },
    [revokeHoldBlob],
  );

  const loadVideoSource = useCallback(
    async (storageKey: string | null, fallbackSrc: string | null) => {
      const seq = loadVideoSeqRef.current + 1;
      loadVideoSeqRef.current = seq;
      revokeVideoBlob();
      setVideoSrc(null);
      setVideoLoading(true);
      setOutputHint(null);

      try {
        if (fallbackSrc && isLocalProjectMediaUrl(fallbackSrc)) {
          setVideoSrc(fallbackSrc);
          return;
        }
        if (fallbackSrc) {
          setVideoSrc(fallbackSrc);
          return;
        }
        if (storageKey) {
          const blobUrl = await fetchProjectorVideoBlobUrl(storageKey);
          if (loadVideoSeqRef.current !== seq) return;
          if (blobUrl) {
            videoBlobRef.current = blobUrl;
            setVideoSrc(blobUrl);
            return;
          }
        }
        reportOutputError(
          "video",
          "файл видео не найден в хранилище — перезагрузите видео в панели проектора",
        );
        setOutputHint("Видео не найдено — нажмите «Выбрать папку…» в Прогоне");
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
        return;
      }
      if (msg.type === "show-hold") {
        activeVideoIdRef.current = null;
        activeHoldIdRef.current = msg.holdId;
        pendingHoldRef.current = {
          storageKey: msg.storageKey,
          fallbackSrc: msg.src,
        };
        setMode("hold");
        setVideoSrc(null);
        revokeVideoBlob();
        void loadHoldImage(msg.storageKey, msg.src);
        reportPlayback(null, msg.holdId, false, "hold");
        requestPresentationMode();
        return;
      }
      if (msg.type === "show-video") {
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
        };
        setMode("video");
        setHoldSrc(null);
        revokeHoldBlob();
        void loadVideoSource(msg.storageKey, msg.src || null);
        requestPresentationMode();
      }
    },
    [
      applyVideoElementState,
      loadHoldImage,
      loadVideoSource,
      requestPresentationMode,
      revokeHoldBlob,
      revokeVideoBlob,
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
    void loadHoldImage(pending.storageKey, pending.fallbackSrc);
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
      onClick={handleRootClick}
      role="presentation"
    >
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

      {!holdLoading && !videoLoading && outputHint ? (
        <p className="projector-output__error">{outputHint}</p>
      ) : null}
    </div>
  );
}
