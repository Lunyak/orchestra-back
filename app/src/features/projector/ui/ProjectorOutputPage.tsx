import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProjectorImageBlobUrl,
  fetchProjectorVideoBlobUrl,
} from "../model/projector-media";
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
) {
  sendProjectorMessage({
    type: "playback-state",
    videoId,
    holdId,
    playing,
    mode,
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
  const videoMutedRef = useRef(false);

  const requestFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
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

      try {
        if (storageKey) {
          const blobUrl = await fetchProjectorImageBlobUrl(storageKey);
          if (loadHoldSeqRef.current !== seq) return;
          if (blobUrl) {
            holdBlobRef.current = blobUrl;
            setHoldSrc(blobUrl);
            return;
          }
        }
        if (fallbackSrc) {
          setHoldSrc(fallbackSrc);
          return;
        }
        reportOutputError(
          "hold",
          "файл заставки не найден в хранилище — перезагрузите заставку в панели проектора",
        );
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

      try {
        if (storageKey) {
          const blobUrl = await fetchProjectorVideoBlobUrl(storageKey);
          if (loadVideoSeqRef.current !== seq) return;
          if (blobUrl) {
            videoBlobRef.current = blobUrl;
            setVideoSrc(blobUrl);
            return;
          }
        }
        if (fallbackSrc) {
          setVideoSrc(fallbackSrc);
          return;
        }
        reportOutputError(
          "video",
          "файл видео не найден в хранилище — перезагрузите видео в панели проектора",
        );
      } finally {
        if (loadVideoSeqRef.current === seq) {
          setVideoLoading(false);
        }
      }
    },
    [revokeVideoBlob],
  );

  const applyMessage = useCallback(
    (msg: ProjectorMessage) => {
      if (msg.type === "set-video-muted") {
        videoMutedRef.current = msg.muted;
        const video = videoRef.current;
        if (video) video.muted = msg.muted;
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
        return;
      }
      if (msg.type === "show-video") {
        activeVideoIdRef.current = msg.videoId;
        activeHoldIdRef.current = msg.holdId;
        videoMutedRef.current = msg.muted ?? false;
        pendingHoldRef.current = {
          storageKey: msg.holdStorageKey,
          fallbackSrc: msg.holdSrc,
        };
        setMode("video");
        setHoldSrc(null);
        revokeHoldBlob();
        void loadVideoSource(msg.storageKey, msg.src || null);
      }
    },
    [loadHoldImage, loadVideoSource, revokeHoldBlob, revokeVideoBlob],
  );

  useEffect(() => {
    const unsub = subscribeProjectorMessages(applyMessage);
    sendProjectorMessage({ type: "ready" });
    requestFullscreen();
    return () => {
      unsub();
      revokeHoldBlob();
      revokeVideoBlob();
    };
  }, [applyMessage, requestFullscreen, revokeHoldBlob, revokeVideoBlob]);

  useEffect(() => {
    if (mode !== "video" || !videoSrc || videoLoading) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = videoMutedRef.current;
    video.load();
    const play = () => {
      void video.play().catch(() => {
        reportOutputError(
          "video",
          "браузер не запустил видео — кликните по экрану проектора",
        );
        reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, false, "video");
      });
    };
    video.addEventListener("loadeddata", play);
    play();
    return () => video.removeEventListener("loadeddata", play);
  }, [mode, videoSrc, videoLoading]);

  const handleVideoPlay = useCallback(() => {
    reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, true, "video");
  }, []);

  const handleVideoPause = useCallback(() => {
    if (mode === "video") {
      reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, false, "video");
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
    reportPlayback(activeVideoIdRef.current, activeHoldIdRef.current, false, "video");
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
    if (!document.fullscreenElement) requestFullscreen();
    const video = videoRef.current;
    if (video && video.paused) void video.play().catch(() => undefined);
  }, [requestFullscreen]);

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
          onEnded={handleVideoEnded}
          onError={handleVideoError}
        />
      ) : null}
    </div>
  );
}
