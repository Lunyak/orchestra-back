import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { api } from "../../../sync/api/client";
import {
  type BackendTtsVoice,
  fetchBackendTtsVoices,
  type SpeakErrorInfo,
} from "./voice-trainer-speech";

export type TtsDiagState = {
  lastRequestedAt: number | null;
  lastText: string;
  lastEvent: "idle" | "request" | "start" | "end" | "error";
  lastError: string;
  voicesCount: number;
};

export function useVoiceTrainerTts(opts: {
  ttsSupported: boolean;
  onTtsUnavailable: () => void;
  voiceName: string;
  stopListening: () => void;
  pttActiveRef: MutableRefObject<boolean>;
}) {
  const { ttsSupported, onTtsUnavailable, voiceName, stopListening, pttActiveRef } = opts;
  const onTtsUnavailableRef = useRef(onTtsUnavailable);
  onTtsUnavailableRef.current = onTtsUnavailable;

  const [voices, setVoices] = useState<BackendTtsVoice[]>([]);
  const [ttsDiag, setTtsDiag] = useState<TtsDiagState>(() => ({
    lastRequestedAt: null,
    lastText: "",
    lastEvent: "idle",
    lastError: "",
    voicesCount: 0,
  }));

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsSessionRef = useRef(0);

  useEffect(() => {
    if (!ttsSupported) return;
    let alive = true;
    fetchBackendTtsVoices()
      .then((v) => {
        if (!alive) return;
        setVoices(v);
        setTtsDiag((p) => ({ ...p, voicesCount: v.length }));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setVoices([]);
        onTtsUnavailableRef.current();
        const message =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: unknown }).message ?? "tts-backend-unavailable")
            : "tts-backend-unavailable";
        setTtsDiag((p) => ({
          ...p,
          voicesCount: 0,
          lastEvent: "error",
          lastError: message,
        }));
      });
    return () => {
      alive = false;
    };
  }, [ttsSupported]);

  const stopTtsAudio = () => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
      } catch {}
      try {
        a.src = "";
      } catch {}
    }
    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {}
      audioUrlRef.current = null;
    }
    audioRef.current = null;
  };

  const requestSpeak = (
    text: string,
    speakOpts?: { onEnd?: () => void; onError?: (info?: SpeakErrorInfo) => void },
  ) => {
    const txt = String(text ?? "").trim();
    stopListening();
    stopTtsAudio();

    setTtsDiag((p) => ({
      ...p,
      lastRequestedAt: Date.now(),
      lastText: txt,
      lastEvent: "request",
      lastError: "",
    }));

    if (!ttsSupported) {
      speakOpts?.onError?.({ code: "tts-unavailable", message: "" });
      return;
    }
    if (!txt) {
      speakOpts?.onEnd?.();
      return;
    }

    const session = ++ttsSessionRef.current;
    const voice = voiceName && voiceName !== "auto" ? voiceName : undefined;
    api
      .post("/tts", { text: txt, voice }, { responseType: "blob" })
      .then((res) => {
        if (session !== ttsSessionRef.current) return;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const a = new Audio(url);
        audioRef.current = a;

        stopListening();
        pttActiveRef.current = false;

        a.onplay = () =>
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "start",
            lastError: "",
          }));
        a.onended = () => {
          if (session !== ttsSessionRef.current) return;
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "end",
            lastError: "",
          }));
          stopTtsAudio();
          speakOpts?.onEnd?.();
        };
        a.onerror = () => {
          if (session !== ttsSessionRef.current) return;
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "error",
            lastError: "audio-playback-failed",
          }));
          stopTtsAudio();
          speakOpts?.onError?.({ code: "audio-playback-failed", message: "" });
        };
        window.setTimeout(() => {
          if (session !== ttsSessionRef.current) return;
          a.play().catch(() => {
            if (session !== ttsSessionRef.current) return;
            setTtsDiag((p) => ({
              ...p,
              lastEvent: "error",
              lastError: "play-rejected",
            }));
            stopTtsAudio();
            speakOpts?.onError?.({ code: "play-rejected", message: "" });
          });
        }, 250);
      })
      .catch((e: unknown) => {
        if (session !== ttsSessionRef.current) return;
        const message =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: unknown }).message ?? "tts-request-failed")
            : "tts-request-failed";
        setTtsDiag((p) => ({
          ...p,
          lastEvent: "error",
          lastError: message,
        }));
        speakOpts?.onError?.({ code: "tts-request-failed", message });
      });
  };

  const playUrl = (
    url: string,
    playOpts?: { onEnd?: () => void; onError?: (info?: SpeakErrorInfo) => void; label?: string },
  ) => {
    const u = String(url ?? "").trim();
    stopListening();
    stopTtsAudio();
    setTtsDiag((p) => ({
      ...p,
      lastRequestedAt: Date.now(),
      lastText: playOpts?.label ? String(playOpts.label) : u,
      lastEvent: "request",
      lastError: "",
    }));
    if (!u) {
      playOpts?.onEnd?.();
      return;
    }
    const session = ++ttsSessionRef.current;
    try {
      audioUrlRef.current = u;
      const a = new Audio(u);
      audioRef.current = a;

      stopListening();
      pttActiveRef.current = false;

      a.onplay = () =>
        setTtsDiag((p) => ({
          ...p,
          lastEvent: "start",
          lastError: "",
        }));
      a.onended = () => {
        if (session !== ttsSessionRef.current) return;
        setTtsDiag((p) => ({
          ...p,
          lastEvent: "end",
          lastError: "",
        }));
        stopTtsAudio();
        playOpts?.onEnd?.();
      };
      a.onerror = () => {
        if (session !== ttsSessionRef.current) return;
        setTtsDiag((p) => ({
          ...p,
          lastEvent: "error",
          lastError: "audio-playback-failed",
        }));
        stopTtsAudio();
        playOpts?.onError?.({ code: "audio-playback-failed", message: "" });
      };
      window.setTimeout(() => {
        if (session !== ttsSessionRef.current) return;
        a.play().catch(() => {
          if (session !== ttsSessionRef.current) return;
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "error",
            lastError: "play-rejected",
          }));
          stopTtsAudio();
          playOpts?.onError?.({ code: "play-rejected", message: "" });
        });
      }, 120);
    } catch {
      playOpts?.onError?.({ code: "audio-playback-failed", message: "" });
    }
  };

  const cancelSpeech = () => {
    ttsSessionRef.current += 1;
    stopTtsAudio();
    setTtsDiag((p) => ({
      ...p,
      lastEvent: "idle",
      lastError: "",
    }));
  };

  const resetTts = () => {
    stopTtsAudio();
    setTtsDiag((p) => ({
      ...p,
      lastRequestedAt: null,
      lastText: "",
      lastEvent: "idle",
      lastError: "",
    }));
  };

  return {
    voices,
    ttsDiag,
    requestSpeak,
    playUrl,
    cancelSpeech,
    resetTts,
    stopTtsAudio,
  };
}
