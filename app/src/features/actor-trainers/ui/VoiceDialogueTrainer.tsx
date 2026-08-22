import cn from "classnames";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { api } from "../../../sync/api/client";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";
import { useAuth } from "../../auth";
import { useProjectRolesQuery } from "../../project/api/project-api";
import { useProject } from "../../project";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { normalizeActorKey } from "../../actor/model/actor-page-helpers";
import {
  selectVoiceTrainerUi,
  voiceTrainerUiActions,
  VOICE_PASS_RATIO_OPTIONS,
  type VoicePassRatioPercent,
} from "../model/voiceTrainerUiSlice";
import {
  uploadVoiceLineTakeWeb,
  type SceneVoiceLineEntry,
} from "../../playbook/model/playbook-slice";
import { Modal } from "../../../shared/core/modal/Modal";
import { useAppEditorMenubarActionsRender } from "../../../shared/components/app-editor-menubar/AppEditorMenubarContext";
import { useAudioInputDevices } from "@shared/media/useAudioInputDevices";
import { VoiceTrainerSettingsPanel } from "./VoiceTrainerSettingsPanel";
import {
  matchStats,
  normalizeForCheck,
  splitIntoSentences,
  stripParentheses,
  tokensForScore,
  ttsPartnerLine,
} from "../model/phraseTextMatch";
import {
  actorDisplayName,
  actorsAssignedToProjectRole,
  findPreferredTake,
  findProjectRoleForScriptKey,
} from "../model/voice-trainer-partner";
import {
  AUTO_RESTART_DELAY_MS,
  BASE_MAX_LISTEN_MS,
  findNextUndoneIndex,
  INITIAL_SILENCE_MS,
  LONG_MONOLOGUE_MAX_LISTEN_MS,
  persistDoneSet,
  readDoneSet,
  RESTART_GRACE_EXTRA_MS,
  SILENCE_STOP_MS_BASE,
  SILENCE_STOP_MS_LONG,
} from "../model/voice-trainer-progress";
import {
  type BackendTtsVoice,
  fetchBackendTtsVoices,
  getSpeechRecognition,
  type SpeakErrorInfo,
} from "../model/voice-trainer-speech";
import type { VoiceExercise } from "../model/voice-trainer-types";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import {
  renderVoiceLineBody,
  VoiceLineControlsPanel,
  type VoiceLineControlsPanelProps,
} from "./VoiceLineControlsPanel";
import { TrainerContextCard } from "./TrainerContextCard";
import "./dialogue-style.css";
import "./voice-style.css";

const voiceTrainerIconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
export function VoiceDialogueTrainer({
  scenes,
  role,
  roleKeys,
  selectedPlaybookIds,
  storageKey,
  performerId,
  performerLabel,
}: {
  scenes: ScriptScene[];
  role: string;
  roleKeys?: string[];
  selectedPlaybookIds: number[];
  storageKey?: string;
  performerId: string;
  performerLabel?: string;
}) {
  const desiredRoleKeySet = useMemo(() => {
    const keys = (roleKeys && roleKeys.length ? roleKeys : [role])
      .map((x) => normalizeRoleKey(String(x ?? "")))
      .filter(Boolean);
    return new Set(keys);
  }, [role, roleKeys]);
  const primaryRoleKey = useMemo(() => {
    // used for uiKey and caches; prefer first provided key, else normalize role label
    const first = roleKeys && roleKeys.length ? normalizeRoleKey(String(roleKeys[0] ?? "")) : "";
    return first || normalizeRoleKey(role);
  }, [role, roleKeys]);
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const dispatch = useAppDispatch();
  const { data: rolesRes } = useProjectRolesQuery(projectName!, {
    skip: !accessToken || !projectName,
  });
  const projectRoles = useMemo(() => rolesRes?.roles ?? [], [rolesRes?.roles]);
  const uiKey = storageKey || `voiceTrainer:${projectName || "project"}:${primaryRoleKey || "role"}`;
  const ui = useAppSelector((s) => selectVoiceTrainerUi(s, uiKey));
  const voiceLines = useAppSelector((s) => s.playbook.playbookData?.voiceLines);
  const voiceUpload = useAppSelector((s) => s.playbook.voiceLinesUpload);

  useEffect(() => {
    dispatch(voiceTrainerUiActions.initVoiceTrainerUi({ uiKey }));
  }, [dispatch, uiKey]);
  const allLines = useMemo(() => {
    const selected = scenes.filter((s) => selectedPlaybookIds.includes(s.id));
    return buildDialogueLines({ scenes: selected, preferField: "playMarkdown" });
  }, [selectedPlaybookIds, scenes]);

  const exercises = useMemo(() => {
    const out: VoiceExercise[] = [];
    for (let idx = 0; idx < allLines.length; idx += 1) {
      const line = allLines[idx] as DialogueLine;
      if (line.kind !== "utterance" || !line.role) continue;
      if (!desiredRoleKeySet.has(normalizeRoleKey(line.role))) continue;
      const prev = (() => {
        for (let j = idx - 1; j >= 0; j -= 1) {
          const p = allLines[j];
          if (p.kind === "utterance" && p.text) return { lineId: p.id, role: p.role, text: p.text };
        }
        return null;
      })();
      const nextPartner = (() => {
        for (let j = idx + 1; j < allLines.length; j += 1) {
          const n = allLines[j];
          if (n.kind !== "utterance" || !n.text) continue;
          const nk = normalizeRoleKey(n.role ?? "");
          if (!nk || desiredRoleKeySet.has(nk)) continue;
          return { lineId: n.id, role: n.role, text: n.text };
        }
        return null;
      })();
      const textForCheck = normalizeForCheck(line.text);
      if (!textForCheck) continue;
      out.push({
        // Use stable line id (sceneId + line index) so progress survives text edits/cleanup.
        id: line.id,
        lineId: line.id,
        sceneId: line.sceneId,
        sceneTitle: line.sceneTitle,
        role: line.role,
        textRaw: line.text,
        textForCheck,
        prev,
        nextPartner,
      });
    }
    return out;
  }, [allLines, desiredRoleKeySet]);

  const exerciseIndexByLineId = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < exercises.length; i += 1) {
      const ex = exercises[i]!;
      m.set(ex.lineId, i);
    }
    return m;
  }, [exercises]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
  const [allDoneDialog, setAllDoneDialog] = useState(false);
  useEffect(() => {
    const restored = readDoneSet(storageKey);
    setDoneIds(restored);
    // After reload, jump to next unfinished line (if any),
    // so user doesn't have to repeat already learned lines.
    if (restored.size > 0 && exercises.length > 0) {
      setIndex((i) => {
        const next = findNextUndoneIndex(exercises, restored, i);
        if (next == null) {
          setAllDoneDialog(true);
          return i;
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  const current = exercises[index] ?? null;
  const [hideUnspokenText, setHideUnspokenText] = useState(true);
  const scriptLineRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!current) return;
    const lineEl = scriptLineRefs.current.get(current.lineId);
    if (!lineEl) return;
    lineEl.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current?.lineId]);

  const roleInfo = useMemo(
    () => findProjectRoleForScriptKey(role, projectRoles),
    [projectRoles, role],
  );

  const lineBeforeActive = useMemo((): DialogueLine | null => {
    if (!current?.prev) return null;
    return {
      id: current.prev.lineId,
      sceneId: current.sceneId,
      sceneTitle: current.sceneTitle,
      kind: "utterance",
      role: current.prev.role,
      text: current.prev.text,
    };
  }, [current]);

  const doneCount = useMemo(() => {
    let c = 0;
    for (const ex of exercises) if (doneIds.has(ex.id)) c += 1;
    return c;
  }, [doneIds, exercises]);

  const expectedTokens = useMemo(() => (current ? tokensForScore(current.textRaw) : []), [current?.id]);

  const [supported, setSupported] = useState(() => ({
    tts: true,
    stt: Boolean(getSpeechRecognition()),
  }));
  useEffect(() => {
    setSupported({ tts: true, stt: Boolean(getSpeechRecognition()) });
  }, []);

  const autoFlow = ui.autoFlow;
  const checkMode = ui.checkMode;
  const passRatioPercent = ui.passRatioPercent;
  const passRatio = passRatioPercent / 100;
  const showText = ui.showText;

  const [revealedLineIds, setRevealedLineIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setRevealedLineIds(new Set());
  }, [uiKey]);

  const [voices, setVoices] = useState<BackendTtsVoice[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileByEmail, setProfileByEmail] = useState<Record<string, TeamProfile | null>>({});
  const profileByEmailRef = useRef(profileByEmail);
  profileByEmailRef.current = profileByEmail;

  useAppEditorMenubarActionsRender("voice-settings", 22, () => (
    <button
      type="button"
      className={cn("app-editor-menubar__panel-btn", settingsOpen && "app-editor-menubar__panel-btn--active")}
      onClick={() => setSettingsOpen((open) => !open)}
      title="Настройки голосового тренажёра"
      aria-label="Настройки голосового тренажёра"
      aria-pressed={settingsOpen}
    >
      🎙
    </button>
  ));

  const voiceName = ui.ttsVoiceName;
  const [ttsDiag, setTtsDiag] = useState<{
    lastRequestedAt: number | null;
    lastText: string;
    lastEvent: "idle" | "request" | "start" | "end" | "error";
    lastError: string;
    voicesCount: number;
  }>(() => ({
    lastRequestedAt: null,
    lastText: "",
    lastEvent: "idle",
    lastError: "",
    voicesCount: 0,
  }));

  useEffect(() => {
    if (!supported.tts) return;
    let alive = true;
    fetchBackendTtsVoices()
      .then((v) => {
        if (!alive) return;
        setVoices(v);
        setTtsDiag((p) => ({ ...p, voicesCount: v.length }));
      })
      .catch((e) => {
        if (!alive) return;
        setVoices([]);
        setSupported((p) => ({ ...p, tts: false }));
        setTtsDiag((p) => ({
          ...p,
          voicesCount: 0,
          lastEvent: "error",
          lastError: String(e?.message ?? "tts-backend-unavailable"),
        }));
      });
    return () => {
      alive = false;
    };
  }, [supported.tts]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsSessionRef = useRef(0);

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
    opts?: { onEnd?: () => void; onError?: (info?: SpeakErrorInfo) => void },
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

    if (!supported.tts) {
      opts?.onError?.({ code: "tts-unavailable", message: "" });
      return;
    }
    if (!txt) {
      opts?.onEnd?.();
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

        // Ensure mic doesn't keep "ducking" audio while playing.
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
          opts?.onEnd?.();
        };
        a.onerror = () => {
          if (session !== ttsSessionRef.current) return;
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "error",
            lastError: "audio-playback-failed",
          }));
          stopTtsAudio();
          opts?.onError?.({ code: "audio-playback-failed", message: "" });
        };
        // Small delay gives the OS time to release mic audio session.
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
            opts?.onError?.({ code: "play-rejected", message: "" });
          });
        }, 250);
      })
      .catch((e) => {
        if (session !== ttsSessionRef.current) return;
        setTtsDiag((p) => ({
          ...p,
          lastEvent: "error",
          lastError: String(e?.message ?? "tts-request-failed"),
        }));
        opts?.onError?.({ code: "tts-request-failed", message: String(e?.message ?? "") });
      });
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

  const playUrl = (
    url: string,
    opts?: { onEnd?: () => void; onError?: (info?: SpeakErrorInfo) => void; label?: string },
  ) => {
    const u = String(url ?? "").trim();
    stopListening();
    stopTtsAudio();
    setTtsDiag((p) => ({
      ...p,
      lastRequestedAt: Date.now(),
      lastText: opts?.label ? String(opts.label) : u,
      lastEvent: "request",
      lastError: "",
    }));
    if (!u) {
      opts?.onEnd?.();
      return;
    }
    const session = ++ttsSessionRef.current;
    try {
      audioUrlRef.current = u;
      const a = new Audio(u);
      audioRef.current = a;

      // Ensure mic doesn't keep "ducking" audio while playing.
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
        opts?.onEnd?.();
      };
      a.onerror = () => {
        if (session !== ttsSessionRef.current) return;
        setTtsDiag((p) => ({
          ...p,
          lastEvent: "error",
          lastError: "audio-playback-failed",
        }));
        stopTtsAudio();
        opts?.onError?.({ code: "audio-playback-failed", message: "" });
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
          opts?.onError?.({ code: "play-rejected", message: "" });
        });
      }, 120);
    } catch {
      opts?.onError?.({ code: "audio-playback-failed", message: "" });
    }
  };

  const speakPartnerLine = useCallback(
    (
      params: { lineId: string; roleKey: string; text: string },
      opts?: { onEnd?: () => void; onError?: () => void },
    ) => {
      const text = stripParentheses(params.text);
      if (!text) {
        opts?.onEnd?.();
        return;
      }
      const roleKey = normalizeRoleKey(params.roleKey);
      const entry =
        params.lineId && voiceLines?.byLineId
          ? (voiceLines.byLineId[params.lineId] as SceneVoiceLineEntry | undefined)
          : undefined;

      const projectRole = findProjectRoleForScriptKey(roleKey, projectRoles);
      const assignedActors = projectRole ? actorsAssignedToProjectRole(projectRole) : [];
      const saved = roleKey ? ui.partnerVoiceByRoleKey?.[roleKey] : undefined;
      let performerId =
        saved?.kind === "performer" ? normalizeActorKey(saved.performerId) : "";
      if (!performerId || !assignedActors.some((a) => a.id === performerId)) {
        performerId = assignedActors[0]?.id ?? "";
      }

      if (performerId && params.lineId) {
        const take = findPreferredTake(entry, performerId);
        const url = take?.remoteUrl;
        if (url) {
          playUrl(url, { onEnd: opts?.onEnd, onError: () => opts?.onError?.(), label: "voice-line" });
          return;
        }
      }

      if (supported.tts) {
        requestSpeak(ttsPartnerLine(text), { onEnd: opts?.onEnd, onError: () => opts?.onError?.() });
        return;
      }
      opts?.onEnd?.();
    },
    [playUrl, projectRoles, requestSpeak, supported.tts, ui.partnerVoiceByRoleKey, voiceLines?.byLineId],
  );

  const recRef = useRef<any | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<null | { ratio: number; ok: boolean }>(null);
  const autoRunTokenRef = useRef(0);
  const pttActiveRef = useRef(false);
  const listenSessionRef = useRef<{
    token: number;
    startedAt: number;
    maxMs: number;
    requested: boolean;
  } | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastActivityAtRef = useRef<number>(0);
  const transcriptRef = useRef<string>("");
  const interimRef = useRef<string>("");
  const evalTokenRef = useRef(0);
  const [lastAccepted, setLastAccepted] = useState<string>("");
  const [currentTarget, setCurrentTarget] = useState<string>("");

  useEffect(() => {
    setTranscript("");
    setInterim("");
    setResult(null);
  }, [current?.id]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    interimRef.current = interim;
  }, [interim]);

  const spokenForEval = () => {
    const a = String(transcriptRef.current ?? "").trim();
    const b = String(interimRef.current ?? "").trim();
    return a && b ? `${a} ${b}`.trim() : a || b;
  };

  const sentenceParts = useMemo(() => {
    if (!current) return [];
    if (checkMode === "sentences") return splitIntoSentences(current.textRaw);
    const s = stripParentheses(current.textRaw).trim();
    return s ? [s] : [];
  }, [current?.id, checkMode]);
  const sentenceTokens = useMemo(() => sentenceParts.map(tokensForScore), [sentenceParts]);
  const [sentenceIndex, setSentenceIndex] = useState(0);

  useEffect(() => {
    setSentenceIndex(0);
    setLastAccepted("");
    setCurrentTarget("");
  }, [current?.id]);

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
  const [lastTake, setLastTake] = useState<null | { blob: Blob; url: string; durationMs: number }>(null);

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
    if (!ui.recordTakes) return;
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
        preferTypes.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";
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

  const stopListening = () => {
    listenSessionRef.current = listenSessionRef.current
      ? { ...listenSessionRef.current, requested: false }
      : null;
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const r = recRef.current;
    setListening(false);
    stopTakeRecording();
    if (!r) return;
    try {
      r.stop();
    } catch {}
    recRef.current = null;
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

  const scheduleSilenceStop = (token: number, silenceMs: number) => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    silenceTimerRef.current = window.setTimeout(() => {
      const sess = listenSessionRef.current;
      if (!sess || sess.token !== token || !sess.requested) return;
      // While Push-To-Talk is held, never auto-stop by silence.
      if (pttActiveRef.current) {
        scheduleSilenceStop(token, silenceMs);
        return;
      }
      const txt = spokenForEval();
      // If user hasn't said anything yet — keep waiting (do not stop).
      if (!txt) {
        scheduleSilenceStop(token, silenceMs);
        return;
      }
      // Stop and let evaluation run on existing transcript.
      stopListening();
      window.setTimeout(() => evaluate(txt), 250);
    }, silenceMs);
  };

  const startListening = (opts?: { resetTranscript?: boolean }) => {
    if (!supported.stt || !current) return;
    const SR = getSpeechRecognition();
    if (!SR) return;
    const r = new SR();
    recRef.current = r;
    r.lang = "ru-RU";
    r.interimResults = true;
    // Some browsers stop quickly; continuous helps where supported.
    r.continuous = true;
    r.maxAlternatives = 1;

    if (opts?.resetTranscript !== false) {
      setTranscript("");
      setInterim("");
      setResult(null);
    } else {
      setInterim("");
    }
    interimRef.current = "";

    r.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const txt = String(res?.[0]?.transcript ?? "").trim();
        if (!txt) continue;
        if (res.isFinal) finalText += (finalText ? " " : "") + txt;
        else interimText += (interimText ? " " : "") + txt;
      }
      lastActivityAtRef.current = Date.now();
      const sess = listenSessionRef.current;
      if (sess?.requested) {
        const silenceMs = (sess.maxMs >= LONG_MONOLOGUE_MAX_LISTEN_MS ? SILENCE_STOP_MS_LONG : SILENCE_STOP_MS_BASE);
        scheduleSilenceStop(sess.token, silenceMs);
      }
      if (finalText) setTranscript((p) => (p ? `${p} ${finalText}` : finalText));
      setInterim(interimText);
      interimRef.current = interimText;
    };

    r.onerror = () => {
      setListening(false);
    };

    r.onend = () => {
      const sess = listenSessionRef.current;
      if (!sess?.requested) {
        setListening(false);
        return;
      }
      const elapsed = Date.now() - sess.startedAt;
      if (elapsed >= sess.maxMs) {
        setListening(false);
        listenSessionRef.current = { ...sess, requested: false };
        return;
      }
      const spoken = spokenForEval();
      // If there is no speech yet — keep restarting (waiting for speech),
      // otherwise we can apply silence logic.
      if (!spoken) {
        window.setTimeout(() => {
          const s2 = listenSessionRef.current;
          if (!s2?.requested) return;
          startListening({ resetTranscript: false });
        }, AUTO_RESTART_DELAY_MS);
        return;
      }
      // While Push-To-Talk is held, keep restarting recognition
      // and only evaluate on button release.
      if (pttActiveRef.current) {
        window.setTimeout(() => {
          const s2 = listenSessionRef.current;
          if (!s2?.requested) return;
          startListening({ resetTranscript: false });
        }, AUTO_RESTART_DELAY_MS);
        return;
      }
      // If we've been silent long enough, do not restart (prevents "noise loops").
      const silenceMs =
        sess.maxMs >= LONG_MONOLOGUE_MAX_LISTEN_MS ? SILENCE_STOP_MS_LONG : SILENCE_STOP_MS_BASE;
      const sinceActivity = Date.now() - (lastActivityAtRef.current || sess.startedAt);
      if (sinceActivity > silenceMs + RESTART_GRACE_EXTRA_MS) {
        setListening(false);
        listenSessionRef.current = { ...sess, requested: false };
        const txt = spokenForEval();
        if (txt) window.setTimeout(() => evaluate(txt), 250);
        return;
      }
      // Auto-restart recognition to avoid "short pause stops everything"
      window.setTimeout(() => {
        const s2 = listenSessionRef.current;
        if (!s2?.requested) return;
        startListening({ resetTranscript: false });
      }, AUTO_RESTART_DELAY_MS);
    };

    try {
      setListening(true);
      r.start();
    } catch {
      setListening(false);
    }
  };

  const evaluate = (spokenText: string) => {
    if (!current) return;
    // prevent duplicate evaluation storms
    const evalToken = evalTokenRef.current + 1;
    evalTokenRef.current = evalToken;

    const spokenTokens = tokensForScore(spokenText);
    const fullExpected = expectedTokens ?? [];
    const { ratio: fullRatio } = matchStats(fullExpected, spokenTokens);
    const fullOk = fullExpected.length > 0 ? fullRatio >= passRatio : false;

    // If user said the whole line well enough — accept immediately (even in sentence mode).
    if (fullOk) {
      setResult({ ratio: fullRatio, ok: true });
      stopListening();
      const acceptedAll = stripParentheses(current.textRaw).trim();
      if (acceptedAll) setLastAccepted(acceptedAll);
      setCurrentTarget("");

      const next = new Set(doneIds);
      next.add(current.id);
      setDoneIds(next);
      persistDoneSet(storageKey, next);

      const after = () => {
        if (!autoFlow) return;
        const nextIndex = findNextUndoneIndex(exercises, next, index);
        if (nextIndex == null) {
          setAllDoneDialog(true);
          return;
        }
        const nextEx = exercises[nextIndex];
        if (nextEx?.id) skipPrevTtsForExerciseIdRef.current = nextEx.id;
        setIndex(nextIndex);
      };

      const np = current.nextPartner;
      const npRoleKey = normalizeRoleKey(np?.role ?? "");
      if (np && npRoleKey) {
        cancelSpeech();
        speakPartnerLine(
          { lineId: np.lineId, roleKey: npRoleKey, text: np.text },
          { onEnd: after, onError: () => after() },
        );
      } else {
        after();
      }
      return;
    }

    // Full-line check mode: one attempt for the whole line.
    if (checkMode === "full" || sentenceTokens.length <= 1) {
      setResult({ ratio: fullRatio, ok: false });
      return;
    }

    // Sentence-based scoring: evaluate current sentence only.
    const sIdx = Math.max(0, Math.min(sentenceIndex, Math.max(0, sentenceTokens.length - 1)));
    const expected = sentenceTokens[sIdx] ?? [];
    const { ratio } = matchStats(expected, spokenTokens);
    const ok = expected.length > 0 ? ratio >= passRatio : false;
    setResult({ ratio, ok });
    if (!ok) return;

    // Stop current recognition session before moving on.
    stopListening();
    const acceptedText = String(sentenceParts[sIdx] ?? "").trim();
    if (acceptedText) setLastAccepted(acceptedText);

    const isLastSentence = sIdx >= sentenceTokens.length - 1;
    if (!isLastSentence) {
      // advance to next sentence, keep transcript but reset buffer for next segment
      const nextIdx = Math.min(sIdx + 1, sentenceTokens.length - 1);
      setSentenceIndex(nextIdx);
      const nextText = String(sentenceParts[nextIdx] ?? "").trim();
      setCurrentTarget(nextText);
      setTranscript("");
      setInterim("");
      setResult(null);
      // keep listening in autoFlow; otherwise user can hit Continue
      if (autoFlow) {
        window.setTimeout(() => {
          beginListeningSession({ resetTranscript: false });
        }, 250);
      }
      return;
    }

    // Whole line completed
    const next = new Set(doneIds);
    next.add(current.id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);

    const after = () => {
      if (!autoFlow) return;
      const nextIndex = findNextUndoneIndex(exercises, next, index);
      if (nextIndex == null) {
        setAllDoneDialog(true);
        return;
      }
      const nextEx = exercises[nextIndex];
      if (nextEx?.id) skipPrevTtsForExerciseIdRef.current = nextEx.id;
      setIndex(nextIndex);
    };

    const np = current.nextPartner;
    const npRoleKey = normalizeRoleKey(np?.role ?? "");
    if (np && npRoleKey) {
      cancelSpeech();
      speakPartnerLine(
        { lineId: np.lineId, roleKey: npRoleKey, text: np.text },
        { onEnd: after, onError: () => after() },
      );
    } else {
      after();
    }
  };

  // Важно: НЕ оцениваем на каждом обновлении transcript.
  // Оценка происходит только при тишине (silence timer) или при отпускании кнопки записи.

  const total = exercises.length;
  const left = Math.max(0, total - doneCount);

  const partnerRolesInScene = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of allLines) {
      if (line.kind !== "utterance" || !line.role) continue;
      const rk = normalizeRoleKey(line.role);
      if (!rk || desiredRoleKeySet.has(rk)) continue;
      if (!map.has(rk)) map.set(rk, line.role);
    }
    return Array.from(map.entries())
      .map(([roleKey, roleTitle]) => ({ roleKey, roleTitle }))
      .sort((a, b) => a.roleTitle.localeCompare(b.roleTitle, "ru"));
  }, [allLines, desiredRoleKeySet]);

  const actorsByPartnerRole = useMemo(() => {
    const out: Record<string, Array<{ id: string; label: string }>> = {};
    for (const { roleKey } of partnerRolesInScene) {
      const projectRole = findProjectRoleForScriptKey(roleKey, projectRoles);
      out[roleKey] = projectRole ? actorsAssignedToProjectRole(projectRole) : [];
    }
    return out;
  }, [partnerRolesInScene, projectRoles]);

  const assignedActorEmails = useMemo(() => {
    const seen = new Set<string>();
    for (const list of Object.values(actorsByPartnerRole)) {
      for (const a of list) {
        if (a.id) seen.add(a.id);
      }
    }
    return Array.from(seen);
  }, [actorsByPartnerRole]);

  useEffect(() => {
    if (!accessToken || assignedActorEmails.length === 0) return;
    const missing = assignedActorEmails.filter((e) => !(e in profileByEmailRef.current));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getProfilesBatch(accessToken, missing);
        if (cancelled) return;
        setProfileByEmail((prev) => {
          const next = { ...prev };
          for (const e of missing) {
            const p = rows.find((r) => normalizeActorKey(r.email) === e);
            next[e] = p ?? null;
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setProfileByEmail((prev) => {
          const next = { ...prev };
          for (const e of missing) next[e] = null;
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, assignedActorEmails]);

  const renderActorSelectPerson = useCallback(
    (option: { value: string } | null) => {
      if (!option?.value.startsWith("p:")) return "—";
      const id = normalizeActorKey(option.value.slice(2));
      const prof = profileByEmail[id];
      const name = actorDisplayName(prof, id);
      const avatar = String(prof?.avatarUrl ?? "").trim() || null;
      return (
        <span className="custom-select__person">
          <MiniAvatar src={avatar} label={name} size={24} title={id} />
          <span className="custom-select__person-name">{name}</span>
        </span>
      );
    },
    [profileByEmail],
  );

  const partnerRoleSelectOptions = useMemo(
    () =>
      partnerRolesInScene.map(({ roleKey, roleTitle }) => {
        const actors = actorsByPartnerRole[roleKey] ?? [];
        return {
          roleKey,
          roleTitle,
          actors,
          options: actors.map((a) => {
            const prof = profileByEmail[a.id];
            return {
              value: `p:${a.id}`,
              label: actorDisplayName(prof, a.label),
            };
          }),
        };
      }),
    [actorsByPartnerRole, partnerRolesInScene, profileByEmail],
  );

  useEffect(() => {
    for (const { roleKey } of partnerRolesInScene) {
      const actors = actorsByPartnerRole[roleKey] ?? [];
      if (actors.length === 0) continue;
      const saved = ui.partnerVoiceByRoleKey?.[roleKey];
      const savedOk =
        saved?.kind === "performer" &&
        actors.some((a) => a.id === normalizeActorKey(saved.performerId));
      if (savedOk) continue;
      dispatch(
        voiceTrainerUiActions.setPartnerVoiceSourceForRole({
          uiKey,
          roleKey,
          source: { kind: "performer", performerId: actors[0]!.id },
        }),
      );
    }
  }, [actorsByPartnerRole, dispatch, partnerRolesInScene, ui.partnerVoiceByRoleKey, uiKey]);

  const voiceSelectOptions = useMemo(
    () => [
      { value: "auto", label: "Авто (по умолчанию)" },
      ...voices.map((v) => ({
        value: v.name,
        label: `${v.name}${v.locale ? ` (${v.locale})` : ""}`,
      })),
    ],
    [voices],
  );

  const checkModeOptions = useMemo(
    () => [
      { value: "full", label: "1 раз (целиком)" },
      { value: "sentences", label: "По предложениям" },
    ],
    [],
  );

  const passRatioOptions = useMemo(
    () =>
      VOICE_PASS_RATIO_OPTIONS.map((value) => ({
        value: String(value),
        label: `${value}%`,
      })),
    [],
  );

  const prevText = current?.prev?.text ? stripParentheses(current.prev.text) : "";
  const myTextNoRemarks = current ? stripParentheses(current.textRaw) : "";
  const prevLineId = current?.prev?.lineId ?? "";
  const prevRoleKey = normalizeRoleKey(current?.prev?.role ?? "");

  const speakPrev = (opts?: { onEnd?: () => void; onError?: () => void }) => {
    if (!prevText || !prevRoleKey || !prevLineId) {
      opts?.onEnd?.();
      return;
    }
    speakPartnerLine({ lineId: prevLineId, roleKey: prevRoleKey, text: prevText }, opts);
  };

  const saveLastTakeAsPreferred = async () => {
    if (!current || !lastTake || !projectName) return;
    const perf = String(performerId ?? "").trim();
    if (!perf) return;
    const rk = normalizeRoleKey(current.role);
    if (!rk) return;
    await dispatch(
      uploadVoiceLineTakeWeb({
        projectSlug: projectName,
        lineId: current.lineId,
        role: current.role,
        roleKey: rk,
        performerId: perf,
        performerLabel: performerLabel || perf,
        blob: lastTake.blob,
        durationMs: lastTake.durationMs,
      }) as any,
    );
    setLastTake((prev) => {
      if (prev?.url) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {}
      }
      return null;
    });
  };

  const resetProgressAll = () => {
    if (!storageKey) return;
    const confirmed = window.confirm("Сбросить весь прогресс голосового тренажёра для этой роли?");
    if (!confirmed) return;
    stopListening();
    cancelSpeech();
    const next = new Set<string>();
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    setIndex(0);
    setSentenceIndex(0);
    setTranscript("");
    setInterim("");
    setResult(null);
    setLastAccepted("");
    setCurrentTarget("");
  };

  const resetProgressCurrent = () => {
    if (!storageKey || !current) return;
    const confirmed = window.confirm("Сбросить прогресс ТОЛЬКО для текущей реплики?");
    if (!confirmed) return;
    const next = new Set(doneIds);
    next.delete(current.id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    setSentenceIndex(0);
    setTranscript("");
    setInterim("");
    setResult(null);
    setLastAccepted("");
    setCurrentTarget("");
  };
  const isLongMonologue = expectedTokens.length >= 40;
  const maxListenMs = isLongMonologue ? LONG_MONOLOGUE_MAX_LISTEN_MS : BASE_MAX_LISTEN_MS;
  const silenceStopMs = isLongMonologue ? SILENCE_STOP_MS_LONG : SILENCE_STOP_MS_BASE;

  useEffect(() => {
    // Update current target sentence label for UI
    const sIdx = Math.max(0, Math.min(sentenceIndex, Math.max(0, sentenceParts.length - 1)));
    const t = String(sentenceParts[sIdx] ?? "").trim();
    setCurrentTarget(t);
  }, [sentenceIndex, sentenceParts]);

  const skipPrevTtsForExerciseIdRef = useRef<string | null>(null);

  if (!current) {
    return (
      <div className={cn("dialogue-trainer", "voice-trainer")}>
        <div className="dialogue-empty">Нет реплик для голосового режима.</div>
      </div>
    );
  }

  const beginListeningSession = (opts: { resetTranscript: boolean }) => {
    if (!supported.stt) return;
    void (async () => {
      const stream = await acquireMicStream();
      if (!stream) return;
      void startTakeRecording();
      const token = Date.now();
      const maxMsEffective = pttActiveRef.current ? Math.max(maxListenMs, 120_000) : maxListenMs;
      listenSessionRef.current = {
        token,
        startedAt: Date.now(),
        maxMs: maxMsEffective,
        requested: true,
      };
      lastActivityAtRef.current = Date.now();
      // Allow some time to start speaking before we consider it "silence".
      scheduleSilenceStop(token, INITIAL_SILENCE_MS);
      if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => stopListening(), maxMsEffective + 250);
      startListening({ resetTranscript: opts.resetTranscript });
    })();
  };

  const stopAndEvaluate = (delayMs: number) => {
    stopListening();
    const txt = spokenForEval();
    if (txt) window.setTimeout(() => evaluate(txt), delayMs);
  };

  const pttStart = () => {
    if (!supported.stt) return;
    if (ttsDiag.lastEvent === "request" || ttsDiag.lastEvent === "start") return;
    if (pttActiveRef.current) return;
    if (listening) return;
    pttActiveRef.current = true;
    beginListeningSession({ resetTranscript: true });
  };
  const pttStop = () => {
    if (!pttActiveRef.current) return;
    pttActiveRef.current = false;
    stopAndEvaluate(100);
  };

  const autoCycleBusy =
    listening || ttsDiag.lastEvent === "request" || ttsDiag.lastEvent === "start";

  const runAuto = () => {
    if (!autoFlow) return;
    if (!supported.stt) return;
    if (left === 0 && total > 0) {
      setAllDoneDialog(true);
      return;
    }

    if (autoCycleBusy) {
      autoRunTokenRef.current += 1;
      stopListening();
      cancelSpeech();
      return;
    }

    stopListening();
    cancelSpeech();

    const token = autoRunTokenRef.current + 1;
    autoRunTokenRef.current = token;

    const startRec = () => {
      if (autoRunTokenRef.current !== token) return;
      beginListeningSession({ resetTranscript: true });
    };

    if (skipPrevTtsForExerciseIdRef.current === current?.id) {
      skipPrevTtsForExerciseIdRef.current = null;
      startRec();
      return;
    }

    if (prevText) {
      speakPrev({ onEnd: startRec, onError: () => startRec() });
      return;
    }
    // no previous phrase — start listening immediately
    startRec();
  };

  const toggleRevealCurrentLine = () => {
    if (!current?.lineId) return;
    setRevealedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(current.lineId)) next.delete(current.lineId);
      else next.add(current.lineId);
      return next;
    });
  };

  const allDone = total > 0 && left === 0;
  const showLearningStage = !allDone && Boolean(current);
  const showScriptStrip = allLines.length > 0;
  const activeScriptLineIndex = current
    ? allLines.findIndex((line) => line.id === current.lineId)
    : -1;

  const lineControlsProps: VoiceLineControlsPanelProps | null = current
    ? {
        current,
        sentenceTokens,
        sentenceIndex,
        showText,
        revealedLineIds,
        onToggleRevealLine: toggleRevealCurrentLine,
        currentTarget,
        lastAccepted,
        supported,
        listening,
        left,
        total,
        pttStart,
        pttStop,
        beginListeningSession,
        autoFlow,
        autoCycleBusy,
        runAuto,
        lastTake,
        playUrl,
        voiceUpload,
        projectName,
        performerId,
        saveLastTakeAsPreferred,
        index,
        exercisesCount: exercises.length,
        onPrev: () => setIndex((i) => Math.max(0, i - 1)),
        onNext: () => setIndex((i) => Math.min(exercises.length - 1, i + 1)),
        myTextNoRemarks,
      }
    : null;

  const goPrevMyLine = () => setIndex((i) => Math.max(0, i - 1));
  const goNextMyLine = () => setIndex((i) => Math.min(exercises.length - 1, i + 1));
  const goNextUndone = () => {
    const next = findNextUndoneIndex(exercises, doneIds, index);
    if (next == null) {
      setAllDoneDialog(true);
      return;
    }
    setIndex(next);
  };

  const jumpToExercise = (lineId: string) => {
    const exerciseIndex = exerciseIndexByLineId.get(lineId);
    if (typeof exerciseIndex !== "number") return;
    setIndex(exerciseIndex);
  };

  const activeLineForBody: DialogueLine | null = current
    ? {
        id: current.lineId,
        sceneId: current.sceneId,
        sceneTitle: current.sceneTitle,
        kind: "utterance",
        role: current.role,
        text: current.textRaw,
      }
    : null;

  const settingsPanelProps = {
    micError,
    micDeviceId,
    micSelectOptions,
    micLabelsReady,
    onMicDeviceChange: (next: string) => {
      setMicDeviceId(next);
      releaseMicStream();
      void acquireMicStream();
    },
    voiceName,
    voiceSelectOptions,
    ttsEnabled: supported.tts,
    onVoiceNameChange: (next: string) =>
      dispatch(voiceTrainerUiActions.setVoiceTtsVoiceName({ uiKey, value: next })),
    checkMode,
    checkModeOptions,
    onCheckModeChange: (next: string) =>
      dispatch(
        voiceTrainerUiActions.setVoiceCheckMode({
          uiKey,
          value: next === "sentences" ? "sentences" : "full",
        }),
      ),
    passRatioPercent,
    passRatioOptions,
    onPassRatioChange: (value: VoicePassRatioPercent) =>
      dispatch(voiceTrainerUiActions.setVoicePassRatioPercent({ uiKey, value })),
    autoFlow,
    onAutoFlowChange: (value: boolean) =>
      dispatch(voiceTrainerUiActions.setVoiceAutoFlow({ uiKey, value })),
    recordTakes: ui.recordTakes,
    onRecordTakesChange: (value: boolean) =>
      dispatch(voiceTrainerUiActions.setVoiceRecordTakes({ uiKey, value })),
    partnerRoleSelectOptions,
    partnerVoiceByRoleKey: ui.partnerVoiceByRoleKey,
    onPartnerVoiceChange: (roleKey: string, performerId: string) =>
      dispatch(
        voiceTrainerUiActions.setPartnerVoiceSourceForRole({
          uiKey,
          roleKey,
          source: { kind: "performer", performerId },
        }),
      ),
    renderActorSelectPerson,
    showText,
    onShowTextChange: (value: boolean) =>
      dispatch(voiceTrainerUiActions.setVoiceShowText({ uiKey, value })),
    prevText,
    onSpeakPrev: () => speakPrev(),
    storageKey,
    onResetProgressCurrent: resetProgressCurrent,
    onResetProgressAll: resetProgressAll,
  };

  return (
    <>
      <div className={cn("dialogue-trainer", "voice-trainer")} data-all-done={allDone ? "true" : "false"}>
        <div className="dialogue-toolbar">
          <div className="dialogue-toolbar-actions">
            <button
              type="button"
              className={cn("dialogue-icon-btn", hideUnspokenText && "dialogue-icon-btn--primary")}
              onClick={() => setHideUnspokenText((value) => !value)}
              aria-label={
                hideUnspokenText
                  ? "Показать непройденный текст"
                  : "Скрыть непройденный текст"
              }
              title={
                hideUnspokenText
                  ? "Показать непройденный текст"
                  : "Скрыть непройденный текст"
              }
              aria-pressed={hideUnspokenText}
            >
              {hideUnspokenText ? (
                <svg {...voiceTrainerIconProps}>
                  <path d="M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.2-5.7" />
                  <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.7 3.8" />
                  <path d="M14.1 9.9a3 3 0 0 1-4.2 4.2" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg {...voiceTrainerIconProps}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="dialogue-icon-btn"
              onClick={goPrevMyLine}
              disabled={index <= 0}
              aria-label="Предыдущая моя реплика"
              title="Предыдущая моя реплика"
            >
              <svg {...voiceTrainerIconProps}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="dialogue-icon-btn"
              onClick={goNextMyLine}
              disabled={index >= exercises.length - 1}
              aria-label="Следующая моя реплика"
              title="Следующая моя реплика"
            >
              <svg {...voiceTrainerIconProps}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              className="dialogue-icon-btn dialogue-icon-btn--primary"
              onClick={goNextUndone}
              disabled={left === 0}
              aria-label="Следующая непройденная"
              title="Следующая непройденная"
            >
              <svg {...voiceTrainerIconProps}>
                <path d="M5 12h10" />
                <path d="M13 6l6 6-6 6" />
                <path d="M5 6v12" />
              </svg>
            </button>
            {storageKey ? (
              <button
                type="button"
                className="dialogue-icon-btn dialogue-icon-btn--danger"
                onClick={resetProgressAll}
                aria-label="Сброс прогресса"
                title="Сброс прогресса"
              >
                <svg {...voiceTrainerIconProps}>
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {!supported.stt ? (
          <div className="voice-warn">
            На этой платформе нет поддержки распознавания речи (SpeechRecognition). Попробуйте Chrome
            или Edge.
          </div>
        ) : null}
        {supported.stt && micError && !settingsOpen ? (
          <div className="voice-warn">{micError}</div>
        ) : null}

        <div className="dialogue-scroll">
          {allDoneDialog && total > 0 ? (
            <div className="dialogue-finished" role="status">
              <div className="dialogue-finished-title">Вы повторили весь текст.</div>
              <div className="dialogue-finished-meta">
                Можно закончить или пройти блок ещё раз.
              </div>
              <div className="voice-actions">
                <button
                  type="button"
                  className="voice-btn"
                  onClick={() => {
                    stopListening();
                    cancelSpeech();
                    setAllDoneDialog(false);
                  }}
                >
                  Закончить
                </button>
                <button
                  type="button"
                  className="voice-btn voice-btn--primary"
                  onClick={() => {
                    resetProgressAll();
                    setAllDoneDialog(false);
                  }}
                >
                  Начать заново
                </button>
              </div>
            </div>
          ) : null}

          {allLines.length === 0 ? (
            <div className="dialogue-empty">
              {selectedPlaybookIds.length === 0
                ? "Выберите сцены в настройках. Если список пуст, выберите роль, у которой есть реплики в тексте."
                : "Нет текста в выбранных сценах (проверьте поле «Текст» в сценах)."}
            </div>
          ) : showLearningStage && current && activeLineForBody ? (
            <div className="dialogue-learning-stage">
              <aside className="dialogue-context-stack" aria-label="Реплика перед вами">
                <TrainerContextCard
                  accessToken={accessToken}
                  line={lineBeforeActive}
                  projectRoles={projectRoles}
                />
              </aside>

              <section className="dialogue-self-card">
                <div className="dialogue-self-card__identity">
                  <RolePlayingCard
                    role={
                      roleInfo ?? {
                        title: role || current.role || "Моя роль",
                        avatarKey: null,
                      }
                    }
                    accessToken={accessToken}
                    size="md"
                    className="dialogue-self-card__portrait"
                  />
                </div>

                <div className="dialogue-self-card__exercise">
                  <div
                    className="dialogue-my-line voice-self-line"
                    data-listening={listening ? "true" : "false"}
                  >
                    <div className="dialogue-my-line-head">
                      <div className="dialogue-my-line-role-row">
                        <div className="dialogue-my-line-role">{current.role}</div>
                        <span className="dialogue-now-badge">Сейчас</span>
                      </div>
                    </div>
                    {renderVoiceLineBody(activeLineForBody, {
                      isActive: true,
                      isMine: true,
                      showText,
                      revealedLineIds,
                      listening,
                      transcript,
                      interim,
                      result,
                      passRatioPercent,
                    })}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        {showLearningStage && lineControlsProps ? (
          <div className="dialogue-word-dock voice-controls-dock" aria-label="Управление репликой">
            <VoiceLineControlsPanel {...lineControlsProps} className="voice-panel--dock" />
          </div>
        ) : null}

        {showScriptStrip ? (
          <section className="dialogue-script-strip" aria-label="Полный сценарий">
            <div className="dialogue-script-strip__head">
              <span className="dialogue-script-strip__title">Сценарий</span>
              <span className="dialogue-script-strip__hint">
                {hideUnspokenText ? "непройденный текст скрыт" : "текущая фраза подсвечена"}
              </span>
            </div>
            <div className="dialogue-script-strip__scroll">
              {allLines.map((line, lineIndex) => {
                const isStage = line.kind === "stage";
                const exerciseIndex = exerciseIndexByLineId.get(line.id);
                const isMine = typeof exerciseIndex === "number";
                const exercise = isMine ? exercises[exerciseIndex]! : null;
                const isActive = Boolean(current && current.lineId === line.id);
                const isPassedByPosition =
                  allDone || (activeScriptLineIndex >= 0 && lineIndex < activeScriptLineIndex);
                const isMineDone = Boolean(exercise && doneIds.has(exercise.id));
                const isDone = !isActive && (isPassedByPosition || isMineDone);
                const hideText = hideUnspokenText && !isDone;
                const roleLabel = line.role ? String(line.role) : "Ремарка";
                const canJump = isMine && !allDone;
                const visibleText = hideText ? "···" : line.text;

                return (
                  <div
                    key={line.id}
                    ref={(el) => {
                      if (!el) {
                        scriptLineRefs.current.delete(line.id);
                        return;
                      }
                      scriptLineRefs.current.set(line.id, el);
                    }}
                    className={cn(
                      "dialogue-script-strip__line",
                      isStage && "dialogue-script-strip__line--stage",
                      isMine && "dialogue-script-strip__line--mine",
                      isActive && "dialogue-script-strip__line--active",
                      isDone && "dialogue-script-strip__line--done",
                      hideText && "dialogue-script-strip__line--hidden-text",
                      canJump && "dialogue-script-strip__line--jumpable",
                    )}
                    onClick={canJump ? () => jumpToExercise(line.id) : undefined}
                    role={canJump ? "button" : undefined}
                    tabIndex={canJump ? 0 : undefined}
                    onKeyDown={
                      canJump
                        ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            jumpToExercise(line.id);
                          }
                        : undefined
                    }
                  >
                    {isStage ? (
                      <span className="dialogue-script-strip__stage">{visibleText}</span>
                    ) : (
                      <>
                        <span className="dialogue-script-strip__role">{roleLabel}</span>
                        <span className="dialogue-script-strip__text">{visibleText}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <footer className="dialogue-footer">
          <div className="dialogue-toolbar-main">
            <div className="dialogue-toolbar-title">
              Роль <b>{role || "—"}</b>
            </div>
            <div className="dialogue-toolbar-meta">
              {allDone ? (
                <>
                  Пройдено <b>{doneCount}</b> / {total} — <b>весь блок завершён</b>
                </>
              ) : (
                <>
                  Пройдено <b>{doneCount}</b> / {total} (осталось {left})
                  {current ? (
                    <>
                      {" "}
                      · сейчас реплика <b>{index + 1}</b>
                    </>
                  ) : null}
                </>
              )}
            </div>
            {current?.sceneTitle ? (
              <div className="dialogue-toolbar-scene">
                Сцена <b>{current.sceneTitle}</b>
              </div>
            ) : null}
          </div>
        </footer>
      </div>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        panelClassName="voice-settings-modal"
        ariaLabel="Настройки голосового тренажёра"
      >
        <div className="voice-settings-modal__header">
          <div>
            <div className="voice-settings-modal__label">Настройки</div>
            <div className="voice-settings-modal__title">Голосовой тренажёр</div>
          </div>
        </div>
        <VoiceTrainerSettingsPanel {...settingsPanelProps} className="voice-controls--modal" />
      </Modal>
    </>
  );
}


