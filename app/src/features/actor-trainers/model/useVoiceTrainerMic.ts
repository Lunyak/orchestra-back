import { useEffect, useRef, useState } from "react";
import { useAudioInputDevices } from "@shared/media/useAudioInputDevices";

export type VoiceTakeRecording = { blob: Blob; url: string; durationMs: number };

export function useVoiceTrainerMic(opts: { recordTakes: boolean }) {
  const { recordTakes } = opts;

  const {
    selectOptions: micSelectOptions,
    selectedDeviceId: micDeviceId,
    setSelectedDeviceId: setMicDeviceId,
    refreshDevices: refreshMicDevices,
    labelsReady: micLabelsReady,
    getConstraints: getMicConstraints,
  } = useAudioInputDevices();
  const [micError, setMicError] = useState<string | null>(null);
  const micDeviceIdRef = useRef(micDeviceId);
  micDeviceIdRef.current = micDeviceId;

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recStartedAtRef = useRef<number>(0);
  const [lastTake, setLastTake] = useState<VoiceTakeRecording | null>(null);

  const releaseMicStream = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    mediaStreamRef.current = null;
  };

  const streamMatchesSelectedDevice = (stream: MediaStream) => {
    const wantId = String(micDeviceIdRef.current ?? "").trim();
    const track = stream.getAudioTracks()[0];
    const currentId = String(track?.getSettings?.()?.deviceId ?? "").trim();
    if (!wantId) return true;
    return currentId === wantId;
  };

  const acquireMicStream = async (): Promise<MediaStream | null> => {
    if (typeof window === "undefined") return null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Браузер не поддерживает доступ к микрофону.");
      return null;
    }
    const current = mediaStreamRef.current;
    if (current?.active && streamMatchesSelectedDevice(current)) {
      setMicError(null);
      return current;
    }
    releaseMicStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMicConstraints());
      mediaStreamRef.current = stream;
      setMicError(null);
      void refreshMicDevices();
      return stream;
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicError("Нет доступа к микрофону. Разрешите запись в настройках браузера.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setMicError("Микрофон не найден. Выберите другое устройство ввода.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setMicError("Микрофон занят другим приложением или недоступен.");
      } else {
        setMicError("Не удалось подключить микрофон.");
      }
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (lastTake?.url) {
        try {
          URL.revokeObjectURL(lastTake.url);
        } catch {}
      }
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") {
        try {
          r.stop();
        } catch {}
      }
      mediaRecorderRef.current = null;
      releaseMicStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTakeRecording = async () => {
    if (!recordTakes) return;
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") return;

    setLastTake((prev) => {
      if (prev?.url) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {}
      }
      return null;
    });

    const stream = mediaStreamRef.current ?? (await acquireMicStream());
    if (!stream) return;

    try {
      const preferTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType =
        preferTypes.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) ||
        "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = rec;
      recChunksRef.current = [];
      recStartedAtRef.current = Date.now();
      rec.ondataavailable = (ev) => {
        if (ev?.data && ev.data.size > 0) recChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const chunks = recChunksRef.current;
        recChunksRef.current = [];
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob || blob.size === 0) return;
        const durationMs = Math.max(0, Date.now() - (recStartedAtRef.current || Date.now()));
        const url = URL.createObjectURL(blob);
        setLastTake({ blob, url, durationMs });
      };
      rec.start();
    } catch {
      setMicError("Не удалось начать запись аудио.");
    }
  };

  const stopTakeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === "inactive") return;
    try {
      rec.stop();
    } catch {}
  };

  return {
    micSelectOptions,
    micDeviceId,
    setMicDeviceId,
    micLabelsReady,
    micError,
    lastTake,
    setLastTake,
    acquireMicStream,
    releaseMicStream,
    startTakeRecording,
    stopTakeRecording,
  };
}
