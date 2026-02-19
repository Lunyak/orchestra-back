import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ScriptStep } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import { tokenizeWords } from "../model/wordTokens";
import { api } from "../../../sync/api";
import "./voice-style.css";

type VoiceExercise = {
  id: string;
  lineId: string;
  stepId: number;
  stepTitle: string;
  role: string;
  textRaw: string;
  textForCheck: string;
  prev?: { role?: string; text: string } | null;
  nextPartner?: { role?: string; text: string } | null;
};

function stripParentheses(text: string): string {
  // MVP: remove ( ... ) blocks (remarks). Nested parentheses are rare; this is sufficient.
  let s = String(text ?? "");
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normalizeForCheck(text: string): string {
  return stripParentheses(text)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  const s = stripParentheses(text);
  if (!s.trim()) return [];
  // Split by .?! keeping it simple (for theatre text it's good enough)
  const parts = s
    .split(/(?<=[.!?])\s+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  // fallback if no punctuation
  return parts.length > 0 ? parts : [s.trim()];
}

function ttsPartnerLine(text: string): string {
  const s = String(text ?? "").trim();
  if (!s) return "";
  if (s.length <= 500) return s;
  const parts = splitIntoSentences(s);
  return String(parts[parts.length - 1] ?? s).trim();
}

const STOP_WORDS = new Set<string>([
  "и",
  "а",
  "но",
  "или",
  "да",
  "в",
  "во",
  "на",
  "по",
  "под",
  "над",
  "за",
  "от",
  "до",
  "из",
  "у",
  "к",
  "ко",
  "с",
  "со",
  "о",
  "об",
  "обо",
  "для",
  "при",
  "без",
  "не",
  "ни",
  "же",
  "ли",
  "бы",
]);

function asHashNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const v = Math.max(0, Math.min(9999, Math.trunc(n)));
  return `#${v}`;
}

function ruNumberWordValue(word: string): number | null {
  const w = String(word ?? "").toLowerCase();
  if (!w) return null;

  // Digits (already normalized to only letters/numbers)
  if (/^\d{1,4}$/.test(w)) return Number(w);

  // Units (some common case forms included)
  const units: Record<string, number> = {
    ноль: 0,
    нуля: 0,
    один: 1,
    одна: 1,
    одно: 1,
    одного: 1,
    одному: 1,
    одином: 1,
    одну: 1,
    одной: 1,
    два: 2,
    две: 2,
    двух: 2,
    двум: 2,
    тремя: 3,
    три: 3,
    трех: 3,
    трёх: 3,
    четырем: 4,
    четыре: 4,
    четырех: 4,
    четырёх: 4,
    пять: 5,
    пяти: 5,
    шесть: 6,
    шести: 6,
    семь: 7,
    семи: 7,
    восемь: 8,
    восьми: 8,
    девять: 9,
    девяти: 9,
  };
  if (w in units) return units[w]!;

  // 10-19 (common case forms)
  const teens: Record<string, number> = {
    десять: 10,
    десяти: 10,
    одиннадцать: 11,
    одиннадцати: 11,
    двенадцать: 12,
    двенадцати: 12,
    тринадцать: 13,
    тринадцати: 13,
    четырнадцать: 14,
    четырнадцати: 14,
    пятнадцать: 15,
    пятнадцати: 15,
    шестнадцать: 16,
    шестнадцати: 16,
    семнадцать: 17,
    семнадцати: 17,
    восемнадцать: 18,
    восемнадцати: 18,
    девятнадцать: 19,
    девятнадцати: 19,
  };
  if (w in teens) return teens[w]!;

  // Tens (common case forms)
  const tens: Array<{ re: RegExp; v: number }> = [
    { re: /^двадцат(ь|и|ью)?$/u, v: 20 },
    { re: /^тридцат(ь|и|ью)?$/u, v: 30 },
    { re: /^сорок(а|у|ом)?$/u, v: 40 },
    { re: /^пятьдесят(и|ью)?$/u, v: 50 },
    { re: /^шестьдесят(и|ью)?$/u, v: 60 },
    { re: /^семьдесят(и|ью)?$/u, v: 70 },
    // 80 has irregular root: восемьдесят / восьмидесяти / восьмьюдесятью
    { re: /^(восемьдесят|восьмидесят|восьмидесяти|восьмьюдесятью)$/u, v: 80 },
    { re: /^девяност(о|а|у|ом)?$/u, v: 90 },
  ];
  for (const t of tens) if (t.re.test(w)) return t.v;

  // 100 (minimal)
  if (w === "сто" || w === "ста" || w === "сот") return 100;

  return null;
}

function normalizeNumberSequences(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const a = tokens[i]!;
    const va = ruNumberWordValue(a);

    // digits
    if (/^\d{1,4}$/.test(a)) {
      out.push(asHashNumber(Number(a)));
      continue;
    }

    // tens + unit (e.g. "двадцать" "два")
    if (va != null && va >= 20 && va % 10 === 0) {
      const b = tokens[i + 1];
      const vb = b ? ruNumberWordValue(b) : null;
      if (vb != null && vb >= 1 && vb <= 9) {
        out.push(asHashNumber(va + vb));
        i += 1;
        continue;
      }
      out.push(asHashNumber(va));
      continue;
    }

    // teens / units / 100
    if (va != null && (va < 20 || va === 100)) {
      out.push(asHashNumber(va));
      continue;
    }

    out.push(a);
  }
  return out;
}

function tokensForScore(text: string): string[] {
  const base = tokenizeWords(normalizeForCheck(text)).map((t) => t.norm);
  const withNums = normalizeNumberSequences(base);
  return withNums.filter((w) => w && !STOP_WORDS.has(w));
}

function matchStats(expected: string[], spoken: string[]): { matched: number; ratio: number } {
  if (expected.length === 0) return { matched: 0, ratio: 0 };
  // Greedy in-order match (allows extra words in speech)
  let i = 0;
  for (let j = 0; j < spoken.length && i < expected.length; j += 1) {
    if (spoken[j] === expected[i]) i += 1;
  }
  return { matched: i, ratio: i / expected.length };
}

const PASS_RATIO = 0.85;
const BASE_MAX_LISTEN_MS = 25_000;
const LONG_MONOLOGUE_MAX_LISTEN_MS = 70_000;
const AUTO_RESTART_DELAY_MS = 250;
const SILENCE_STOP_MS_BASE = 1200;
const SILENCE_STOP_MS_LONG = 1700;
const RESTART_GRACE_EXTRA_MS = 300;
const INITIAL_SILENCE_MS = 4500;

function readDoneSet(storageKey?: string): Set<string> {
  if (!storageKey) return new Set<string>();
  if (typeof window === "undefined") return new Set<string>();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.map((x) => String(x ?? "")).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function persistDoneSet(storageKey: string | undefined, next: Set<string>) {
  if (!storageKey) return;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(next.values())));
  } catch {
    // ignore
  }
}

function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type SpeakErrorInfo = {
  code: string;
  message: string;
};

type BackendTtsVoice = { name: string; locale?: string };

async function fetchBackendTtsVoices(): Promise<BackendTtsVoice[]> {
  const res = await api.get("/tts/voices");
  const data = res.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((x: any) => ({
      name: String(x?.name ?? ""),
      locale: x?.locale ? String(x.locale) : undefined,
    }))
    .filter((v) => v.name);
}

function findNextUndoneIndex(exercises: VoiceExercise[], done: Set<string>, fromIndex: number): number {
  if (exercises.length === 0) return 0;
  const start = Math.max(0, Math.min(fromIndex, exercises.length - 1));
  for (let offset = 1; offset <= exercises.length; offset += 1) {
    const idx = (start + offset) % exercises.length;
    if (!done.has(exercises[idx]!.id)) return idx;
  }
  return start;
}

export function VoiceDialogueTrainer({
  steps,
  role,
  selectedStepIds,
  storageKey,
}: {
  steps: ScriptStep[];
  role: string;
  selectedStepIds: number[];
  storageKey?: string;
}) {
  const roleKey = normalizeRoleKey(role);
  const allLines = useMemo(() => {
    const selected = steps.filter((s) => selectedStepIds.includes(s.id));
    return buildDialogueLines({ steps: selected, preferField: "playMarkdown" });
  }, [selectedStepIds, steps]);

  const exercises = useMemo(() => {
    const out: VoiceExercise[] = [];
    for (let idx = 0; idx < allLines.length; idx += 1) {
      const line = allLines[idx] as DialogueLine;
      if (line.kind !== "utterance" || !line.role) continue;
      if (normalizeRoleKey(line.role) !== roleKey) continue;
      const prev = (() => {
        for (let j = idx - 1; j >= 0; j -= 1) {
          const p = allLines[j];
          if (p.kind === "utterance" && p.text) return { role: p.role, text: p.text };
        }
        return null;
      })();
      const nextPartner = (() => {
        for (let j = idx + 1; j < allLines.length; j += 1) {
          const n = allLines[j];
          if (n.kind !== "utterance" || !n.text) continue;
          const nk = normalizeRoleKey(n.role ?? "");
          if (!nk || nk === roleKey) continue;
          return { role: n.role, text: n.text };
        }
        return null;
      })();
      const textForCheck = normalizeForCheck(line.text);
      if (!textForCheck) continue;
      out.push({
        id: `${line.stepId}:${line.role}:${line.text}`,
        lineId: line.id,
        stepId: line.stepId,
        stepTitle: line.stepTitle,
        role: line.role,
        textRaw: line.text,
        textForCheck,
        prev,
        nextPartner,
      });
    }
    return out;
  }, [allLines, roleKey]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
  useEffect(() => {
    setDoneIds(readDoneSet(storageKey));
  }, [storageKey]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  const current = exercises[index] ?? null;

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

  const [autoFlow, setAutoFlow] = useState(true);

  const [checkMode, setCheckMode] = useState<"full" | "sentences">(() => {
    if (typeof window === "undefined") return "full";
    const v = localStorage.getItem("voiceDialogue:checkMode");
    return v === "sentences" ? "sentences" : "full";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("voiceDialogue:checkMode", checkMode);
  }, [checkMode]);

  const [voices, setVoices] = useState<BackendTtsVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    return localStorage.getItem("voiceDialogue:ttsVoiceName") ?? "auto";
  });
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
    if (typeof window === "undefined") return;
    localStorage.setItem("voiceDialogue:ttsVoiceName", voiceName);
  }, [voiceName]);

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

    const voice = voiceName && voiceName !== "auto" ? voiceName : undefined;
    api
      .get("/tts", { params: { text: txt, voice }, responseType: "blob" })
      .then((res) => {
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const a = new Audio(url);
        audioRef.current = a;

        a.onplay = () =>
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "start",
            lastError: "",
          }));
        a.onended = () => {
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "end",
            lastError: "",
          }));
          stopTtsAudio();
          opts?.onEnd?.();
        };
        a.onerror = () => {
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "error",
            lastError: "audio-playback-failed",
          }));
          stopTtsAudio();
          opts?.onError?.({ code: "audio-playback-failed", message: "" });
        };
        a.play().catch(() => {
          setTtsDiag((p) => ({
            ...p,
            lastEvent: "error",
            lastError: "play-rejected",
          }));
          stopTtsAudio();
          opts?.onError?.({ code: "play-rejected", message: "" });
        });
      })
      .catch((e) => {
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

  const recRef = useRef<any | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<null | { ratio: number; ok: boolean }>(null);
  const [showText, setShowText] = useState(false);
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
    setShowText(false);
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
    if (!r) return;
    try {
      r.stop();
    } catch {}
  };

  const cancelSpeech = () => {
    stopTtsAudio();
  };

  const scheduleSilenceStop = (token: number, silenceMs: number) => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    silenceTimerRef.current = window.setTimeout(() => {
      const sess = listenSessionRef.current;
      if (!sess || sess.token !== token || !sess.requested) return;
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
    const fullOk = fullExpected.length > 0 ? fullRatio >= PASS_RATIO : false;

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
        const nextEx = exercises[nextIndex];
        if (nextEx?.id) skipPrevTtsForExerciseIdRef.current = nextEx.id;
        setIndex(nextIndex);
      };

      if (supported.tts && nextPartnerTextTts) {
        cancelSpeech();
        requestSpeak(nextPartnerTextTts, { onEnd: after, onError: () => after() });
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
    const ok = expected.length > 0 ? ratio >= PASS_RATIO : false;
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
      const nextEx = exercises[nextIndex];
      if (nextEx?.id) skipPrevTtsForExerciseIdRef.current = nextEx.id;
      setIndex(nextIndex);
    };

    if (supported.tts && nextPartnerTextTts) {
      cancelSpeech();
      requestSpeak(nextPartnerTextTts, { onEnd: after, onError: () => after() });
    } else {
      after();
    }
  };

  // Важно: НЕ оцениваем на каждом обновлении transcript.
  // Оценка происходит только при тишине (silence timer) или при отпускании кнопки записи.

  const total = exercises.length;
  const left = Math.max(0, total - doneCount);

  if (!current) {
    return <div className="voice-empty">Нет реплик для голосового режима.</div>;
  }

  const prevText = current.prev?.text ? stripParentheses(current.prev.text) : "";
  const prevTextTts = ttsPartnerLine(prevText);
  const nextPartnerText = current.nextPartner?.text ? stripParentheses(current.nextPartner.text) : "";
  const nextPartnerTextTts = ttsPartnerLine(nextPartnerText);
  const myTextNoRemarks = stripParentheses(current.textRaw);

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

  const beginListeningSession = (opts: { resetTranscript: boolean }) => {
    if (!supported.stt) return;
    const token = Date.now();
    listenSessionRef.current = {
      token,
      startedAt: Date.now(),
      maxMs: maxListenMs,
      requested: true,
    };
    lastActivityAtRef.current = Date.now();
    // Allow some time to start speaking before we consider it "silence".
    scheduleSilenceStop(token, INITIAL_SILENCE_MS);
    if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => stopListening(), maxListenMs + 250);
    startListening({ resetTranscript: opts.resetTranscript });
  };

  const stopAndEvaluate = (delayMs: number) => {
    stopListening();
    const txt = spokenForEval();
    if (txt) window.setTimeout(() => evaluate(txt), delayMs);
  };

  const pttActiveRef = useRef(false);
  const pttStart = () => {
    if (!supported.stt) return;
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

  const skipPrevTtsForExerciseIdRef = useRef<string | null>(null);

  const runAuto = () => {
    if (!autoFlow) return;
    if (!supported.stt) return;
    // stop any current recognition and speech
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

    if (supported.tts && prevText) {
      requestSpeak(prevTextTts || prevText, { onEnd: startRec, onError: () => startRec() });
      return;
    }
    // no previous phrase — start listening immediately
    startRec();
  };


  return (
    <div className="voice-trainer">
      <div className="voice-head">
        <div className="voice-title">
          Голос — роль <b>{role || "—"}</b>
        </div>
        <div className="voice-meta">
          Пройдено <b>{doneCount}</b> / {total} (осталось {left})
        </div>
      </div>

      {!supported.stt ? (
        <div className="voice-warn">
          На этой платформе нет поддержки распознавания речи (SpeechRecognition).
        </div>
      ) : null}

      <div className="voice-card">
        <div className="voice-context">
          <div className="voice-label">Предыдущая реплика</div>
          <div className="voice-line">
            <div className="voice-role">{current.prev?.role ?? "—"}</div>
            <div className="voice-text">{prevText || "—"}</div>
          </div>
          <div className="voice-actions">
            <button
              type="button"
              className="voice-btn"
              disabled={!supported.tts || !prevText}
              onClick={() => requestSpeak(prevTextTts || prevText)}
              title={!supported.tts ? "TTS недоступен" : "Озвучить предыдущую реплику"}
            >
              Озвучить
            </button>

            <label className="voice-select">
              <span className="voice-select-label">Голос</span>
              <select
                className="voice-select-input"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                disabled={!supported.tts}
              >
                <option value="auto">Авто (по умолчанию)</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}{v.locale ? ` (${v.locale})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="voice-checkbox">
              <input
                type="checkbox"
                checked={autoFlow}
                onChange={(e) => setAutoFlow(e.target.checked)}
              />
              авто (переход)
            </label>
            <label className="voice-select">
              <span className="voice-select-label">Проверка</span>
              <select
                className="voice-select-input"
                value={checkMode}
                onChange={(e) => setCheckMode(e.target.value === "sentences" ? "sentences" : "full")}
              >
                <option value="full">1 раз (целиком)</option>
                <option value="sentences">По предложениям</option>
              </select>
            </label>
            {storageKey ? (
              <>
                <button type="button" className="voice-btn" onClick={resetProgressCurrent} title="Сбросить текущую реплику">
                  Сбросить текущую
                </button>
                <button type="button" className="voice-btn" onClick={resetProgressAll} title="Сбросить весь прогресс">
                  Сбросить прогресс
                </button>
              </>
            ) : null}
            <div className="voice-hint">
              Запись держится до {Math.round(maxListenMs / 1000)}с и не обрывается на коротких паузах.
              {isLongMonologue ? " Длинный монолог: можно говорить кусочками." : ""}
            </div>
            <div className="voice-hint" style={{ maxWidth: 520 }}>
              TTS:{" "}
              <b>{supported.tts ? "есть" : "нет"}</b>, voices: <b>{ttsDiag.voicesCount}</b>
              {ttsDiag.lastRequestedAt ? (
                <>
                  {" "}
                  · последнее: <b>{ttsDiag.lastEvent}</b>
                  {ttsDiag.lastError ? <> · ошибка: {ttsDiag.lastError}</> : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="voice-task">
          <div className="voice-label">Твоя реплика</div>
          <div className="voice-task-row">
            <div className="voice-role">{current.role}</div>
            <div className="voice-task-meta">
              Шаг: <b>{current.stepTitle}</b>
            </div>
          </div>

          {sentenceTokens.length > 1 ? (
            <div className="voice-progress">
              Фраза: <b>{sentenceIndex + 1}</b> / {sentenceTokens.length}
            </div>
          ) : null}
          {currentTarget ? (
            <div className="voice-target">
              Сейчас: “{String(currentTarget).slice(0, 160)}{String(currentTarget).length > 160 ? "…" : ""}”
            </div>
          ) : null}
          {lastAccepted ? (
            <div className="voice-muted">Засчитано: “{String(lastAccepted).slice(0, 120)}{String(lastAccepted).length > 120 ? "…" : ""}”</div>
          ) : null}

          <div className="voice-actions">
            <button
              type="button"
              className="voice-btn voice-ptt"
              data-active={listening ? "true" : "false"}
              disabled={!supported.stt}
              onPointerDown={(e) => {
                // prevent synthetic mouse events after touch
                try { (e.currentTarget as any)?.setPointerCapture?.(e.pointerId); } catch {}
                e.preventDefault();
                pttStart();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                pttStop();
              }}
              onPointerCancel={() => pttStop()}
              onPointerLeave={() => {
                // if user drags finger/mouse away while holding
                if (pttActiveRef.current) pttStop();
              }}
              title="Нажми и держи — идёт запись. Отпусти — проверим."
            >
              {listening ? "Запись…" : "Нажми и держи"}
            </button>
            <button
              type="button"
              className="voice-btn"
              disabled={!supported.stt}
              onClick={() => {
                beginListeningSession({ resetTranscript: false });
              }}
              title="Продолжить запись без сброса"
            >
              Продолжить
            </button>
            <button
              type="button"
              className="voice-btn"
              disabled={!supported.stt || !autoFlow}
              onClick={runAuto}
              title="Озвучить предыдущую и начать запись"
            >
              ▶ цикл
            </button>
            <button type="button" className="voice-btn" onClick={() => setShowText((v) => !v)}>
              {showText ? "Скрыть текст" : "Показать текст"}
            </button>
            <div className="voice-spacer" />
            <button type="button" className="voice-btn" disabled={index <= 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              ←
            </button>
            <button type="button" className="voice-btn" disabled={index >= exercises.length - 1} onClick={() => setIndex((i) => Math.min(exercises.length - 1, i + 1))}>
              →
            </button>
          </div>

          {showText ? (
            <div className="voice-textbox">
              <div className="voice-label">Текст (без ремарок)</div>
              <div className="voice-text">{myTextNoRemarks || "—"}</div>
            </div>
          ) : null}

          <div className="voice-recognition">
            <div className="voice-label">Распознано</div>
            <div className="voice-transcript">
              {transcript || interim ? (
                <>
                  <div>{transcript}</div>
                  {interim ? <div className="voice-interim">{interim}</div> : null}
                </>
              ) : (
                <div className="voice-muted">Пока пусто.</div>
              )}
            </div>
            {result ? (
              <div className={`voice-result ${result.ok ? "ok" : "bad"}`}>
                {result.ok ? "Похоже, верно." : "Не совпадает достаточно."} Точность:{" "}
                <b>{Math.round(result.ratio * 100)}%</b>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

