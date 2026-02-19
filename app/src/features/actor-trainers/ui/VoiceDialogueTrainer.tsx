import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ScriptStep } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import { tokenizeWords } from "../model/wordTokens";
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

function tokensForScore(text: string): string[] {
  return tokenizeWords(normalizeForCheck(text))
    .map((t) => t.norm)
    .filter((w) => w && !STOP_WORDS.has(w));
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

function canSpeak(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

type TtsVoice = SpeechSynthesisVoice;

function getVoicesSafe(): TtsVoice[] {
  if (!canSpeak()) return [];
  try {
    return window.speechSynthesis.getVoices?.() ?? [];
  } catch {
    return [];
  }
}

function pickPreferredRuVoice(voices: TtsVoice[]): TtsVoice | null {
  const ru = (voices ?? []).filter((v) => String(v.lang ?? "").toLowerCase().startsWith("ru"));
  if (ru.length === 0) return null;
  const score = (v: TtsVoice) => {
    const name = String(v.name ?? "").toLowerCase();
    let s = 0;
    // heuristic: some engines sound more natural
    if (name.includes("google")) s += 50;
    if (name.includes("yandex")) s += 48;
    if (name.includes("microsoft")) s += 40;
    if (name.includes("siri")) s += 35;
    if (v.localService) s += 8;
    if (String(v.lang ?? "").toLowerCase() === "ru-ru") s += 6;
    return s;
  };
  return ru.slice().sort((a, b) => score(b) - score(a))[0] ?? ru[0] ?? null;
}

function speakText(opts: {
  text: string;
  voice: TtsVoice | null;
  onEnd?: () => void;
  onError?: () => void;
}) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch {}
  const u = new SpeechSynthesisUtterance(opts.text);
  u.lang = "ru-RU";
  u.rate = 1;
  u.pitch = 1;
  if (opts.voice) u.voice = opts.voice;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onError?.();
  synth.speak(u);
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
    tts: canSpeak(),
    stt: Boolean(getSpeechRecognition()),
  }));
  useEffect(() => {
    setSupported({ tts: canSpeak(), stt: Boolean(getSpeechRecognition()) });
  }, []);

  const [autoFlow, setAutoFlow] = useState(true);

  const [voices, setVoices] = useState<TtsVoice[]>(() => getVoicesSafe());
  const [voiceUri, setVoiceUri] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    return localStorage.getItem("voiceDialogue:ttsVoiceUri") ?? "auto";
  });

  useEffect(() => {
    if (!supported.tts) return;
    const update = () => setVoices(getVoicesSafe());
    update();
    // voices list can load asynchronously
    (window.speechSynthesis as any).onvoiceschanged = update;
    return () => {
      try {
        (window.speechSynthesis as any).onvoiceschanged = null;
      } catch {}
    };
  }, [supported.tts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("voiceDialogue:ttsVoiceUri", voiceUri);
  }, [voiceUri]);

  const effectiveVoice = useMemo(() => {
    if (!supported.tts) return null;
    if (voiceUri && voiceUri !== "auto") {
      return voices.find((v) => String(v.voiceURI ?? "") === voiceUri) ?? null;
    }
    return pickPreferredRuVoice(voices);
  }, [supported.tts, voiceUri, voices]);

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

  useEffect(() => {
    setTranscript("");
    setInterim("");
    setResult(null);
    setShowText(false);
  }, [current?.id]);

  const sentenceParts = useMemo(() => (current ? splitIntoSentences(current.textRaw) : []), [current?.id]);
  const sentenceTokens = useMemo(() => sentenceParts.map(tokensForScore), [sentenceParts]);
  const [sentenceIndex, setSentenceIndex] = useState(0);

  useEffect(() => {
    setSentenceIndex(0);
  }, [current?.id]);

  const stopListening = () => {
    listenSessionRef.current = listenSessionRef.current
      ? { ...listenSessionRef.current, requested: false }
      : null;
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const r = recRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {}
  };

  const cancelSpeech = () => {
    if (!supported.tts) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
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
      setSentenceIndex(0);
      setInterim("");
      setResult(null);
    } else {
      setInterim("");
    }

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
      if (finalText) setTranscript((p) => (p ? `${p} ${finalText}` : finalText));
      setInterim(interimText);
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
    // Sentence-based scoring: evaluate current sentence only.
    const sIdx = Math.max(0, Math.min(sentenceIndex, Math.max(0, sentenceTokens.length - 1)));
    const expected = sentenceTokens[sIdx] ?? [];
    const spokenTokens = tokensForScore(spokenText);
    const { ratio } = matchStats(expected, spokenTokens);
    const ok = expected.length > 0 ? ratio >= PASS_RATIO : false;
    setResult({ ratio, ok });
    if (!ok) return;

    // Stop current recognition session before moving on.
    stopListening();

    const isLastSentence = sIdx >= sentenceTokens.length - 1;
    if (!isLastSentence) {
      // advance to next sentence, keep transcript but reset buffer for next segment
      setSentenceIndex((p) => Math.min(p + 1, sentenceTokens.length - 1));
      setTranscript("");
      setInterim("");
      setResult(null);
      // keep listening in autoFlow; otherwise user can hit Continue
      if (autoFlow) {
        window.setTimeout(() => {
          // Continue listening without resetting session timers externally
          startListening({ resetTranscript: false });
        }, 250);
      }
      return;
    }

    // Whole line completed
    const next = new Set(doneIds);
    next.add(current.id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);

    if (autoFlow) {
      const nextIndex = findNextUndoneIndex(exercises, next, index);
      window.setTimeout(() => setIndex(nextIndex), 220);
    }
  };

  useEffect(() => {
    if (!current) return;
    if (!transcript) return;
    // Debounce evaluation slightly to wait for final result aggregation
    const t = window.setTimeout(() => evaluate(transcript), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, current?.id, sentenceIndex]);

  const total = exercises.length;
  const left = Math.max(0, total - doneCount);

  if (!current) {
    return <div className="voice-empty">Нет реплик для голосового режима.</div>;
  }

  const prevText = current.prev?.text ? stripParentheses(current.prev.text) : "";
  const myTextNoRemarks = stripParentheses(current.textRaw);
  const isLongMonologue = expectedTokens.length >= 40;
  const maxListenMs = isLongMonologue ? LONG_MONOLOGUE_MAX_LISTEN_MS : BASE_MAX_LISTEN_MS;

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
      listenSessionRef.current = {
        token,
        startedAt: Date.now(),
        maxMs: maxListenMs,
        requested: true,
      };
      if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => {
        const sess = listenSessionRef.current;
        if (!sess || sess.token !== token) return;
        stopListening();
      }, maxListenMs + 250);
      startListening({ resetTranscript: true });
    };

    if (supported.tts && prevText) {
      speakText({
        text: prevText,
        voice: effectiveVoice,
        onEnd: startRec,
        onError: startRec,
      });
      return;
    }
    // no previous phrase — start listening immediately
    startRec();
  };

  // Auto-run when exercise changes
  useEffect(() => {
    if (!current) return;
    if (!autoFlow) return;
    // do not auto-run if already completed and there are undone remaining
    runAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, autoFlow, supported.stt, supported.tts, voiceUri]);

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
              onClick={() =>
                speakText({
                  text: prevText,
                  voice: effectiveVoice,
                })
              }
              title={!supported.tts ? "TTS недоступен" : "Озвучить предыдущую реплику"}
            >
              Озвучить
            </button>
            <label className="voice-select">
              <span className="voice-select-label">Голос</span>
              <select
                className="voice-select-input"
                value={voiceUri}
                onChange={(e) => setVoiceUri(e.target.value)}
                disabled={!supported.tts}
              >
                <option value="auto">Авто (лучший RU)</option>
                {voices.map((v) => (
                  <option key={String(v.voiceURI)} value={String(v.voiceURI)}>
                    {String(v.name)} ({String(v.lang)})
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
              авто
            </label>
            <div className="voice-hint">
              Запись держится до {Math.round(maxListenMs / 1000)}с и не обрывается на коротких паузах.
              {isLongMonologue ? " Длинный монолог: можно говорить кусочками." : ""}
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

          <div className="voice-actions">
            <button
              type="button"
              className="voice-btn voice-btn--primary"
              disabled={!supported.stt || listening}
              onClick={() => {
                listenSessionRef.current = {
                  token: Date.now(),
                  startedAt: Date.now(),
                  maxMs: maxListenMs,
                  requested: true,
                };
                if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
                stopTimerRef.current = window.setTimeout(() => stopListening(), maxListenMs + 250);
                startListening({ resetTranscript: true });
              }}
            >
              {listening ? "Слушаю…" : "Начать запись"}
            </button>
            <button
              type="button"
              className="voice-btn"
              disabled={!supported.stt || listening}
              onClick={() => {
                // Continue without resetting transcript/buffer.
                const token = Date.now();
                listenSessionRef.current = {
                  token,
                  startedAt: Date.now(),
                  maxMs: maxListenMs,
                  requested: true,
                };
                if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
                stopTimerRef.current = window.setTimeout(() => stopListening(), maxListenMs + 250);
                startListening({ resetTranscript: false });
              }}
              title="Продолжить запись без сброса"
            >
              Продолжить
            </button>
            <button type="button" className="voice-btn" disabled={!supported.stt || !listening} onClick={stopListening}>
              Стоп
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

