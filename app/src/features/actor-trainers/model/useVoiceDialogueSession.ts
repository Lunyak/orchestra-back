import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { useAppDispatch } from "../../../shared/store/hooks";
import { normalizeActorKey } from "../../actor/model/actor-page-helpers";
import {
  uploadVoiceLineTakeWeb,
  type SceneVoiceLineEntry,
} from "../../playbook/model/playbook-slice";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { normalizeRoleKey } from "./dialogue";
import {
  matchStats,
  splitIntoSentences,
  stripParentheses,
  tokensForScore,
  ttsPartnerLine,
} from "./phraseTextMatch";
import type { TtsDiagState } from "./useVoiceTrainerTts";
import type { VoiceTakeRecording } from "./useVoiceTrainerMic";
import {
  actorsAssignedToProjectRole,
  findPreferredTake,
  findProjectRoleForScriptKey,
} from "./voice-trainer-partner";
import {
  AUTO_RESTART_DELAY_MS,
  BASE_MAX_LISTEN_MS,
  findNextUndoneIndex,
  INITIAL_SILENCE_MS,
  LONG_MONOLOGUE_MAX_LISTEN_MS,
  RESTART_GRACE_EXTRA_MS,
  SILENCE_STOP_MS_BASE,
  SILENCE_STOP_MS_LONG,
} from "./voice-trainer-progress";
import { getSpeechRecognition, type SpeakErrorInfo } from "./voice-trainer-speech";
import type { VoiceExercise } from "./voice-trainer-types";
import type { PartnerVoiceSource, VoiceTrainerCheckMode } from "./voiceTrainerUiSlice";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function useVoiceDialogueSession(opts: {
  current: VoiceExercise | null;
  exercises: VoiceExercise[];
  index: number;
  setIndex: Dispatch<SetStateAction<number>>;
  doneIds: Set<string>;
  markDone: (exerciseId: string) => Set<string>;
  setAllDoneDialog: (open: boolean) => void;
  autoFlow: boolean;
  checkMode: VoiceTrainerCheckMode;
  passRatio: number;
  supported: { tts: boolean; stt: boolean };
  ttsDiag: TtsDiagState;
  requestSpeak: (
    text: string,
    speakOpts?: { onEnd?: () => void; onError?: (info?: SpeakErrorInfo) => void },
  ) => void;
  playUrl: (
    url: string,
    playOpts?: { onEnd?: () => void; onError?: (info?: SpeakErrorInfo) => void; label?: string },
  ) => void;
  cancelSpeech: () => void;
  projectRoles: ProjectRoleInfo[];
  partnerVoiceByRoleKey: Record<string, PartnerVoiceSource | undefined>;
  voiceLinesByLineId: Record<string, SceneVoiceLineEntry | undefined> | undefined;
  acquireMicStream: () => Promise<MediaStream | null>;
  startTakeRecording: () => Promise<void>;
  stopTakeRecording: () => void;
  lastTake: VoiceTakeRecording | null;
  setLastTake: Dispatch<SetStateAction<VoiceTakeRecording | null>>;
  projectName: string | null | undefined;
  performerId: string;
  performerLabel?: string;
  left: number;
  total: number;
  pttActiveRef: MutableRefObject<boolean>;
  skipPrevTtsForExerciseIdRef: MutableRefObject<string | null>;
}) {
  const {
    current,
    exercises,
    index,
    setIndex,
    doneIds,
    markDone,
    setAllDoneDialog,
    autoFlow,
    checkMode,
    passRatio,
    supported,
    ttsDiag,
    requestSpeak,
    playUrl,
    cancelSpeech,
    projectRoles,
    partnerVoiceByRoleKey,
    voiceLinesByLineId,
    acquireMicStream,
    startTakeRecording,
    stopTakeRecording,
    lastTake,
    setLastTake,
    projectName,
    performerId,
    performerLabel,
    left,
    total,
    pttActiveRef,
    skipPrevTtsForExerciseIdRef,
  } = opts;

  const dispatch = useAppDispatch();

  const expectedTokens = useMemo(
    () => (current ? tokensForScore(current.textRaw) : []),
    [current?.id],
  );

  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<null | { ratio: number; ok: boolean }>(null);
  const autoRunTokenRef = useRef(0);
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

  const speakPartnerLine = useCallback(
    (
      params: { lineId: string; roleKey: string; text: string },
      speakOpts?: { onEnd?: () => void; onError?: () => void },
    ) => {
      const text = stripParentheses(params.text);
      if (!text) {
        speakOpts?.onEnd?.();
        return;
      }
      const roleKey = normalizeRoleKey(params.roleKey);
      const entry =
        params.lineId && voiceLinesByLineId
          ? (voiceLinesByLineId[params.lineId] as SceneVoiceLineEntry | undefined)
          : undefined;

      const projectRole = findProjectRoleForScriptKey(roleKey, projectRoles);
      const assignedActors = projectRole ? actorsAssignedToProjectRole(projectRole) : [];
      const saved = roleKey ? partnerVoiceByRoleKey?.[roleKey] : undefined;
      let performer =
        saved?.kind === "performer" ? normalizeActorKey(saved.performerId) : "";
      if (!performer || !assignedActors.some((a) => a.id === performer)) {
        performer = assignedActors[0]?.id ?? "";
      }

      if (performer && params.lineId) {
        const take = findPreferredTake(entry, performer);
        const url = take?.remoteUrl;
        if (url) {
          playUrl(url, {
            onEnd: speakOpts?.onEnd,
            onError: () => speakOpts?.onError?.(),
            label: "voice-line",
          });
          return;
        }
      }

      if (supported.tts) {
        requestSpeak(ttsPartnerLine(text), {
          onEnd: speakOpts?.onEnd,
          onError: () => speakOpts?.onError?.(),
        });
        return;
      }
      speakOpts?.onEnd?.();
    },
    [partnerVoiceByRoleKey, playUrl, projectRoles, requestSpeak, supported.tts, voiceLinesByLineId],
  );

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

  const scheduleSilenceStop = (token: number, silenceMs: number) => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    silenceTimerRef.current = window.setTimeout(() => {
      const sess = listenSessionRef.current;
      if (!sess || sess.token !== token || !sess.requested) return;
      if (pttActiveRef.current) {
        scheduleSilenceStop(token, silenceMs);
        return;
      }
      const txt = spokenForEval();
      if (!txt) {
        scheduleSilenceStop(token, silenceMs);
        return;
      }
      stopListening();
      window.setTimeout(() => evaluate(txt), 250);
    }, silenceMs);
  };

  const startListening = (listenOpts?: { resetTranscript?: boolean }) => {
    if (!supported.stt || !current) return;
    const SR = getSpeechRecognition() as (new () => SpeechRecognitionInstance) | null;
    if (!SR) return;
    const r = new SR();
    recRef.current = r;
    r.lang = "ru-RU";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;

    if (listenOpts?.resetTranscript !== false) {
      setTranscript("");
      setInterim("");
      setResult(null);
    } else {
      setInterim("");
    }
    interimRef.current = "";

    r.onresult = (event: SpeechRecognitionEventLike) => {
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
        const silenceMs =
          sess.maxMs >= LONG_MONOLOGUE_MAX_LISTEN_MS ? SILENCE_STOP_MS_LONG : SILENCE_STOP_MS_BASE;
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
      if (!spoken) {
        window.setTimeout(() => {
          const s2 = listenSessionRef.current;
          if (!s2?.requested) return;
          startListening({ resetTranscript: false });
        }, AUTO_RESTART_DELAY_MS);
        return;
      }
      if (pttActiveRef.current) {
        window.setTimeout(() => {
          const s2 = listenSessionRef.current;
          if (!s2?.requested) return;
          startListening({ resetTranscript: false });
        }, AUTO_RESTART_DELAY_MS);
        return;
      }
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
    const evalToken = evalTokenRef.current + 1;
    evalTokenRef.current = evalToken;

    const spokenTokens = tokensForScore(spokenText);
    const fullExpected = expectedTokens ?? [];
    const { ratio: fullRatio } = matchStats(fullExpected, spokenTokens);
    const fullOk = fullExpected.length > 0 ? fullRatio >= passRatio : false;

    if (fullOk) {
      setResult({ ratio: fullRatio, ok: true });
      stopListening();
      const acceptedAll = stripParentheses(current.textRaw).trim();
      if (acceptedAll) setLastAccepted(acceptedAll);
      setCurrentTarget("");

      const next = markDone(current.id);

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

    if (checkMode === "full" || sentenceTokens.length <= 1) {
      setResult({ ratio: fullRatio, ok: false });
      return;
    }

    const sIdx = Math.max(0, Math.min(sentenceIndex, Math.max(0, sentenceTokens.length - 1)));
    const expected = sentenceTokens[sIdx] ?? [];
    const { ratio } = matchStats(expected, spokenTokens);
    const ok = expected.length > 0 ? ratio >= passRatio : false;
    setResult({ ratio, ok });
    if (!ok) return;

    stopListening();
    const acceptedText = String(sentenceParts[sIdx] ?? "").trim();
    if (acceptedText) setLastAccepted(acceptedText);

    const isLastSentence = sIdx >= sentenceTokens.length - 1;
    if (!isLastSentence) {
      const nextIdx = Math.min(sIdx + 1, sentenceTokens.length - 1);
      setSentenceIndex(nextIdx);
      const nextText = String(sentenceParts[nextIdx] ?? "").trim();
      setCurrentTarget(nextText);
      setTranscript("");
      setInterim("");
      setResult(null);
      if (autoFlow) {
        window.setTimeout(() => {
          beginListeningSession({ resetTranscript: false });
        }, 250);
      }
      return;
    }

    const next = markDone(current.id);

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

  const prevText = current?.prev?.text ? stripParentheses(current.prev.text) : "";
  const myTextNoRemarks = current ? stripParentheses(current.textRaw) : "";
  const prevLineId = current?.prev?.lineId ?? "";
  const prevRoleKey = normalizeRoleKey(current?.prev?.role ?? "");

  const speakPrev = (speakOpts?: { onEnd?: () => void; onError?: () => void }) => {
    if (!prevText || !prevRoleKey || !prevLineId) {
      speakOpts?.onEnd?.();
      return;
    }
    speakPartnerLine({ lineId: prevLineId, roleKey: prevRoleKey, text: prevText }, speakOpts);
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
      }),
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

  const isLongMonologue = expectedTokens.length >= 40;
  const maxListenMs = isLongMonologue ? LONG_MONOLOGUE_MAX_LISTEN_MS : BASE_MAX_LISTEN_MS;

  useEffect(() => {
    const sIdx = Math.max(0, Math.min(sentenceIndex, Math.max(0, sentenceParts.length - 1)));
    const t = String(sentenceParts[sIdx] ?? "").trim();
    setCurrentTarget(t);
  }, [sentenceIndex, sentenceParts]);

  const beginListeningSession = (sessionOpts: { resetTranscript: boolean }) => {
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
      scheduleSilenceStop(token, INITIAL_SILENCE_MS);
      if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => stopListening(), maxMsEffective + 250);
      startListening({ resetTranscript: sessionOpts.resetTranscript });
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
    startRec();
  };

  const resetSessionBuffers = () => {
    setSentenceIndex(0);
    setTranscript("");
    setInterim("");
    setResult(null);
    setLastAccepted("");
    setCurrentTarget("");
  };

  return {
    listening,
    transcript,
    interim,
    result,
    sentenceTokens,
    sentenceIndex,
    lastAccepted,
    currentTarget,
    myTextNoRemarks,
    prevText,
    stopListening,
    beginListeningSession,
    pttStart,
    pttStop,
    autoCycleBusy,
    runAuto,
    speakPrev,
    saveLastTakeAsPreferred,
    resetSessionBuffers,
    setSentenceIndex,
  };
}
