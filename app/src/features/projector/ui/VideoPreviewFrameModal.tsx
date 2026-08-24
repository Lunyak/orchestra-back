import { Modal } from "@shared/core/modal/Modal";
import { Button } from "@shared/core/button/Button";
import { useEffect, useRef, useState } from "react";
import {
  resolveProjectorVideoFramePickerCandidates,
  type ProjectorMediaContext,
  type ProjectorVideoFramePickerCandidate,
} from "../model/projector-media";
import {
  normalizeVideoPreviewTimeSec,
  resolveVideoPreviewSeekTime,
} from "../model/projector-video-preview";
import "./video-preview-frame-modal.css";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function readSeekableDuration(video: HTMLVideoElement): number {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }
  try {
    if (video.seekable.length > 0) {
      const end = video.seekable.end(video.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export type VideoPreviewFrameModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ctx: ProjectorMediaContext;
  videoId: number;
  title: string;
  initialPreviewTimeSec?: number | null;
  onConfirm: (previewTimeSec: number) => void;
};

export function VideoPreviewFrameModal({
  isOpen,
  onClose,
  ctx,
  videoId,
  title,
  initialPreviewTimeSec = null,
  onConfirm,
}: VideoPreviewFrameModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ownedBlobUrlsRef = useRef<string[]>([]);
  const initialSeekDoneRef = useRef(false);
  const candidatesRef = useRef<ProjectorVideoFramePickerCandidate[]>([]);
  const candidateIndexRef = useRef(0);
  const loadWatchdogRef = useRef<number | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearWatchdog = () => {
    if (loadWatchdogRef.current != null) {
      window.clearTimeout(loadWatchdogRef.current);
      loadWatchdogRef.current = null;
    }
  };

  const revokeOwnedBlobs = () => {
    for (const url of ownedBlobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    ownedBlobUrlsRef.current = [];
  };

  const applyCandidate = (index: number) => {
    const list = candidatesRef.current;
    const next = list[index];
    candidateIndexRef.current = index;
    initialSeekDoneRef.current = false;
    setDuration(0);
    setError("");
    if (!next) {
      setSrc(null);
      setLoading(false);
      setError("Не удалось открыть видео для выбора кадра");
      return;
    }
    setLoading(true);
    setSrc(next.src);
    clearWatchdog();
    loadWatchdogRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && readSeekableDuration(video) > 0) return;
      tryNextCandidate();
    }, 4000);
  };

  const tryNextCandidate = () => {
    const nextIndex = candidateIndexRef.current + 1;
    if (nextIndex >= candidatesRef.current.length) {
      clearWatchdog();
      setLoading(false);
      setError(
        "Браузер не смог прочитать ролик. Перезагрузите видео в панели или выберите папку с файлом.",
      );
      return;
    }
    applyCandidate(nextIndex);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    initialSeekDoneRef.current = false;
    candidateIndexRef.current = 0;
    candidatesRef.current = [];
    setError("");
    setLoading(true);
    setSrc(null);
    setDuration(0);
    setTime(normalizeVideoPreviewTimeSec(initialPreviewTimeSec) ?? 0.25);

    void resolveProjectorVideoFramePickerCandidates(ctx, videoId).then((list) => {
      if (cancelled) {
        for (const item of list) {
          if (item.blob) URL.revokeObjectURL(item.src);
        }
        return;
      }
      ownedBlobUrlsRef.current = list.filter((item) => item.blob).map((item) => item.src);
      candidatesRef.current = list;
      if (list.length === 0) {
        setLoading(false);
        setError("Не удалось открыть видео для выбора кадра");
        return;
      }
      applyCandidate(0);
    });

    return () => {
      cancelled = true;
      clearWatchdog();
      revokeOwnedBlobs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, initialPreviewTimeSec, isOpen, videoId]);

  const refreshFromVideo = (video: HTMLVideoElement) => {
    const nextDuration = readSeekableDuration(video);
    if (nextDuration > 0) {
      clearWatchdog();
      setDuration(nextDuration);
      setLoading(false);
      setError("");
    }

    if (!initialSeekDoneRef.current && nextDuration > 0) {
      initialSeekDoneRef.current = true;
      const seekTo = resolveVideoPreviewSeekTime(
        initialPreviewTimeSec,
        nextDuration,
      );
      setTime(seekTo);
      try {
        video.currentTime = seekTo;
      } catch {
        /* wait for canplay */
      }
    }
  };

  const applySeek = (nextTime: number) => {
    const video = videoRef.current;
    const capped = resolveVideoPreviewSeekTime(
      nextTime,
      duration > 0 ? duration : undefined,
    );
    setTime(capped);
    if (!video) return;
    try {
      video.currentTime = capped;
    } catch {
      /* ignore */
    }
  };

  const handleVideoError = (video: HTMLVideoElement) => {
    if (readSeekableDuration(video) > 0 || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError("");
      return;
    }
    tryNextCandidate();
  };

  const sliderReady = Boolean(src) && duration > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="video-preview-frame-modal"
      ariaLabelledBy="video-preview-frame-modal-title"
    >
      <div className="video-preview-frame-modal__body">
        <h2
          id="video-preview-frame-modal-title"
          className="video-preview-frame-modal__title"
        >
          Кадр превью
        </h2>
        <p className="video-preview-frame-modal__subtitle">{title}</p>
        {src ? (
          <video
            key={src}
            ref={videoRef}
            className="video-preview-frame-modal__video"
            src={src}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(event) => refreshFromVideo(event.currentTarget)}
            onDurationChange={(event) => refreshFromVideo(event.currentTarget)}
            onLoadedData={(event) => refreshFromVideo(event.currentTarget)}
            onCanPlay={(event) => refreshFromVideo(event.currentTarget)}
            onSeeked={(event) => {
              const video = event.currentTarget;
              const nextDuration = readSeekableDuration(video);
              if (nextDuration > 0) {
                setDuration(nextDuration);
                setError("");
                setLoading(false);
                clearWatchdog();
              }
            }}
            onError={(event) => handleVideoError(event.currentTarget)}
          />
        ) : (
          <div className="video-preview-frame-modal__placeholder">
            {error || (loading ? "Загрузка ролика…" : "Нет видео")}
          </div>
        )}
        <label className="video-preview-frame-modal__slider-field">
          <span className="video-preview-frame-modal__slider-label">
            Время кадра
            <span className="video-preview-frame-modal__slider-value">
              {formatTime(time)}
              {duration > 0
                ? ` / ${formatTime(duration)}`
                : src
                  ? " · читаю…"
                  : ""}
            </span>
          </span>
          <input
            className="video-preview-frame-modal__slider"
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.05}
            value={Math.min(time, duration > 0 ? duration : time)}
            disabled={!sliderReady}
            onChange={(event) => applySeek(Number(event.target.value))}
            aria-label="Время кадра превью"
          />
        </label>
        {error && !sliderReady ? (
          <p className="video-preview-frame-modal__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="video-preview-frame-modal__actions">
          <Button type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!src || !sliderReady}
            onClick={() => {
              const next = normalizeVideoPreviewTimeSec(time, duration) ?? 0.25;
              onConfirm(next);
            }}
          >
            Сохранить кадр
          </Button>
        </div>
      </div>
    </Modal>
  );
}
