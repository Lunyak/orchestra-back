import cn from "classnames";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScriptStep } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import { tokenizeWords } from "../model/wordTokens";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { api } from "../../../sync/api/client";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";
import { useAuth } from "../../auth";
import { useProjectRolesQuery } from "../../project/api/project-api";
import { useProject } from "../../project";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { normalizeActorKey } from "../../actor/model/actor-page-helpers";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import {
  selectVoiceTrainerUi,
  voiceTrainerUiActions,
  VOICE_PASS_RATIO_OPTIONS,
  type PartnerVoiceSource,
  type VoicePassRatioPercent,
} from "../model/voiceTrainerUiSlice";
import {
  uploadVoiceLineTakeWeb,
  type SceneVoiceLineEntry,
  type SceneVoiceLineTake,
} from "../../scene/model/scene-slice";
import { Modal } from "../../../shared/core/modal/Modal";
import { useAppEditorMenubarActionsRender } from "../../../shared/components/app-editor-menubar/AppEditorMenubarContext";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import { useAudioInputDevices } from "@shared/media/useAudioInputDevices";
import { VoiceTrainerSettingsPanel } from "./VoiceTrainerSettingsPanel";
import "./voice-style.css";

type VoiceExercise = {
  id: string;
  lineId: string;
  stepId: number;
  stepTitle: string;
  role: string;
  textRaw: string;
  textForCheck: string;
  prev?: { lineId: string; role?: string; text: string } | null;
  nextPartner?: { lineId: string; role?: string; text: string } | null;
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
  const v = Math.max(0, Math.min(999_999_999, Math.trunc(n)));
  return `#${v}`;
}

const RU_THOUSAND_WORDS = new Set<string>([
  "тысяча",
  "тысячи",
  "тысяч",
  "тысяче",
  "тысячу",
  "тысячей",
  "тысячами",
]);

const RU_MILLION_WORDS = new Set<string>([
  "миллион",
  "миллиона",
  "миллионов",
  "миллионе",
  "миллионом",
  "миллионами",
]);

const RU_BILLION_WORDS = new Set<string>([
  "миллиард",
  "миллиарда",
  "миллиардов",
  "миллиарде",
  "миллиардом",
  "миллиардами",
]);

function ruScaleMultiplier(word: string): number | null {
  const w = String(word ?? "").toLowerCase();
  if (!w) return null;
  if (RU_THOUSAND_WORDS.has(w)) return 1_000;
  if (RU_MILLION_WORDS.has(w)) return 1_000_000;
  if (RU_BILLION_WORDS.has(w)) return 1_000_000_000;
  return null;
}

function ruNumberWordValue(word: string): number | null {
  const w = String(word ?? "").toLowerCase();
  if (!w) return null;

  // Digits (already normalized to only letters/numbers)
  if (/^\d+$/.test(w)) return Number(w);

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

function consumeRuBaseNumber(tokens: string[], i: number): { value: number; nextIndex: number } | null {
  const a = tokens[i];
  if (!a) return null;

  // Digits, including "grouped" forms split by punctuation: 9 000 000 -> 9000000
  if (/^\d+$/.test(a)) {
    if (/^\d{1,3}$/.test(a)) {
      let s = a;
      let j = i + 1;
      while (j < tokens.length && /^\d{3}$/.test(tokens[j] ?? "")) {
        s += tokens[j];
        j += 1;
      }
      return { value: Number(s), nextIndex: j };
    }
    return { value: Number(a), nextIndex: i + 1 };
  }

  const va = ruNumberWordValue(a);
  if (va == null) return null;

  // tens + unit (e.g. "двадцать" "два")
  if (va >= 20 && va % 10 === 0) {
    const b = tokens[i + 1];
    const vb = b ? ruNumberWordValue(b) : null;
    if (vb != null && vb >= 1 && vb <= 9) return { value: va + vb, nextIndex: i + 2 };
    return { value: va, nextIndex: i + 1 };
  }

  return { value: va, nextIndex: i + 1 };
}

function normalizeNumberSequences(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const parsed = consumeRuBaseNumber(tokens, i);
    if (!parsed) {
      // Handle standalone scale words like "с тысячи" -> 1000
      const mult = ruScaleMultiplier(tokens[i] ?? "");
      if (mult) {
        out.push(asHashNumber(mult));
      } else {
        out.push(tokens[i]!);
      }
      continue;
    }

    let value = parsed.value;
    let j = parsed.nextIndex;

    // Scale words: "девять тысяч" -> 9000, "9 тысяч" -> 9000
    const mult = ruScaleMultiplier(tokens[j] ?? "");
    if (mult) {
      value *= mult;
      j += 1;

      // Optional remainder: "9 тысяч 500" (rare in scripts, but helps STT output)
      const rem = consumeRuBaseNumber(tokens, j);
      if (rem && rem.value >= 0 && rem.value < mult) {
        value += rem.value;
        j = rem.nextIndex;
      }
    }

    out.push(asHashNumber(value));
    i = j - 1;
  }
  return out;
}

function tokensForScore(text: string): string[] {
  const base = tokenizeWords(normalizeForCheck(text)).map((t) => t.norm);
  const withNums = normalizeNumberSequences(base);
  const filtered = withNums.filter((w) => w && !STOP_WORDS.has(w));
  return filtered.map(normalizeTokenForScore).filter(Boolean);
}

function normalizeTokenForScore(token: string): string {
  const t = String(token ?? "").trim().toLowerCase();
  if (!t) return "";
  if (t.startsWith("#")) return t; // normalized numbers

  // Ruble forms & abbreviations: "рубля", "руб.", "руб" -> "руб"
  if (/^руб(л(я|ей|ю|ем|лях|лям|ли)?)?$/u.test(t)) return "руб";

  return softStemRu(t);
}

function softStemRu(word: string): string {
  const w = String(word ?? "").toLowerCase();
  if (!w) return "";
  if (w.length <= 4) return w;

  // Very lightweight stemming for matching STT case/ending variants.
  const endings = [
    "иями",
    "ями",
    "ами",
    "ого",
    "ему",
    "ому",
    "ыми",
    "ими",
    "иях",
    "ях",
    "ах",
    "ам",
    "ям",
    "ала",
    "али",
    "ало",
    "ал",
    "ых",
    "их",
    "ым",
    "им",
    "ов",
    "ев",
    "ом",
    "ем",
    "ой",
    "ей",
    "ую",
    "юю",
    "ая",
    "яя",
    "ое",
    "ее",
    "ый",
    "ий",
    "ые",
    "ие",
    "а",
    "я",
    "ы",
    "и",
    "у",
    "ю",
    "е",
    "о",
  ];

  for (const end of endings) {
    if (!w.endsWith(end)) continue;
    const base = w.slice(0, Math.max(0, w.length - end.length));
    if (base.length >= 3) return base;
  }

  return w;
}

function editDistanceLeq1(aRaw: string, bRaw: string): boolean {
  const a = String(aRaw ?? "");
  const b = String(bRaw ?? "");
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  const diff = Math.abs(la - lb);
  if (diff > 1) return false;

  // Same length: allow 1 substitution
  if (la === lb) {
    let mism = 0;
    for (let i = 0; i < la; i += 1) {
      if (a[i] !== b[i]) mism += 1;
      if (mism > 1) return false;
    }
    return mism === 1;
  }

  // Length differs by 1: allow 1 insertion/deletion
  const s = la < lb ? a : b;
  const t = la < lb ? b : a;
  let i = 0;
  let j = 0;
  let skipped = 0;
  while (i < s.length && j < t.length) {
    if (s[i] === t[j]) {
      i += 1;
      j += 1;
      continue;
    }
    skipped += 1;
    if (skipped > 1) return false;
    j += 1;
  }
  return true;
}

function matchStats(expected: string[], spoken: string[]): { matched: number; ratio: number } {
  if (expected.length === 0) return { matched: 0, ratio: 0 };
  if (spoken.length === 0) return { matched: 0, ratio: 0 };

  // LCS-based matching: tolerates missing/extra words.
  // This avoids the "one missed word blocks the whole tail" problem of greedy matching.
  const m = spoken.length;
  const dp = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= expected.length; i += 1) {
    let prevDiag = 0;
    const e = expected[i - 1]!;
    for (let j = 1; j <= m; j += 1) {
      const tmp = dp[j]!;
      const s = spoken[j - 1]!;
      if (s === e || editDistanceLeq1(s, e)) {
        dp[j] = prevDiag + 1;
      } else {
        dp[j] = Math.max(dp[j]!, dp[j - 1]!);
      }
      prevDiag = tmp;
    }
  }

  const matched = dp[m] ?? 0;
  return { matched, ratio: matched / expected.length };
}

const BASE_MAX_LISTEN_MS = 45_000;
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

function findPreferredTake(
  entry: SceneVoiceLineEntry | undefined,
  perfId: string,
): SceneVoiceLineTake | null {
  if (!entry) return null;
  const list = entry.takesByPerformer?.[perfId] ?? [];
  if (list.length === 0) return null;
  const preferredId = entry.preferredTakeIdByPerformer?.[perfId];
  if (preferredId) {
    const found = list.find((t) => t.id === preferredId);
    if (found) return found;
  }
  return list[list.length - 1] ?? null;
}

function projectRoleKeys(role: ProjectRoleInfo): string[] {
  const out: string[] = [];
  if (role.key) out.push(normalizeRoleKey(role.key));
  if (role.title) out.push(normalizeRoleKey(role.title));
  for (const a of role.aliases ?? []) {
    const k = normalizeRoleKey(String(a ?? ""));
    if (k) out.push(k);
  }
  return out;
}

function findProjectRoleForScriptKey(
  scriptRoleKey: string,
  projectRoles: ProjectRoleInfo[],
): ProjectRoleInfo | null {
  const wanted = normalizeRoleKey(scriptRoleKey);
  if (!wanted) return null;
  for (const role of projectRoles) {
    if (projectRoleKeys(role).includes(wanted)) return role;
  }
  return null;
}

function actorDisplayName(profile: TeamProfile | null | undefined, email: string): string {
  const first = String(profile?.firstName ?? "").trim();
  const last = String(profile?.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const display = String(profile?.displayName ?? "").trim();
  if (display) return display;
  return String(email ?? "").trim() || "—";
}

function actorsAssignedToProjectRole(role: ProjectRoleInfo): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];
  for (const raw of role.emails ?? []) {
    const label = String(raw ?? "").trim();
    const id = normalizeActorKey(label);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: label || id });
  }
  return out;
}

function findNextUndoneIndex(
  exercises: VoiceExercise[],
  done: Set<string>,
  fromIndex: number,
): number | null {
  if (exercises.length === 0) return null;
  const start = Math.max(0, Math.min(fromIndex, exercises.length - 1));
  for (let offset = 1; offset <= exercises.length; offset += 1) {
    const idx = (start + offset) % exercises.length;
    if (!done.has(exercises[idx]!.id)) return idx;
  }
  return null;
}

const voiceIconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function VoiceIconButton({
  label,
  title,
  disabled,
  active,
  className,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn("voice-icon-btn", active && "voice-icon-btn--active", className)}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
    >
      {children}
    </button>
  );
}

type VoiceLineControlsPanelProps = {
  className?: string;
  current: VoiceExercise;
  sentenceTokens: string[][];
  sentenceIndex: number;
  showText: boolean;
  revealedLineIds: Set<string>;
  onToggleRevealLine: () => void;
  currentTarget: string;
  lastAccepted: string;
  supported: { tts: boolean; stt: boolean };
  listening: boolean;
  left: number;
  total: number;
  pttStart: () => void;
  pttStop: () => void;
  beginListeningSession: (opts: { resetTranscript: boolean }) => void;
  autoFlow: boolean;
  autoCycleBusy: boolean;
  runAuto: () => void;
  lastTake: null | { blob: Blob; url: string; durationMs: number };
  playUrl: (url: string, opts?: { label?: string }) => void;
  voiceUpload: { uploading: boolean; error?: string | null };
  projectName: string | null | undefined;
  performerId: string;
  saveLastTakeAsPreferred: () => void | Promise<void>;
  index: number;
  exercisesCount: number;
  onPrev: () => void;
  onNext: () => void;
  myTextNoRemarks: string;
};

function renderVoiceLineBody(
  line: DialogueLine,
  opts: {
    isActive: boolean;
    isMine: boolean;
    showText: boolean;
    revealedLineIds: Set<string>;
    listening: boolean;
    transcript: string;
    interim: string;
    result: null | { ratio: number; ok: boolean };
    passRatioPercent: number;
  },
) {
  const {
    isActive,
    isMine,
    showText,
    revealedLineIds,
    listening,
    transcript,
    interim,
    result,
    passRatioPercent,
  } = opts;

  if (isActive && isMine && (listening || transcript || interim || result)) {
    return (
      <>
        <div className="voice-text voice-text--live">
          {transcript ? <span>{transcript}</span> : null}
          {interim ? (
            <span className="voice-interim">
              {transcript ? " " : ""}
              {interim}
            </span>
          ) : null}
          {!transcript && !interim && listening ? (
            <span className="voice-interim voice-interim--placeholder">…</span>
          ) : null}
        </div>
        {result ? (
          <div
            className={cn(
              "voice-line-result",
              result.ok ? "voice-line-result--ok" : "voice-line-result--bad",
            )}
          >
            {result.ok ? "Похоже, верно." : `Не совпадает достаточно (нужно ≥${passRatioPercent}%).`} Точность:{" "}
            <b>{Math.round(result.ratio * 100)}%</b>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="voice-text">
      {isMine && !(showText || revealedLineIds.has(line.id)) ? "— текст скрыт —" : line.text}
    </div>
  );
}

const VOICE_LINE_SHEET_DISMISS_PX = 72;
const VOICE_LINE_SHEET_TAP_PX = 6;

function VoiceLineSheet({
  expanded,
  onExpandedChange,
  children,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
}) {
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finishDrag = useCallback(() => {
    const offset = dragOffsetRef.current;
    if (expanded) {
      if (offset >= VOICE_LINE_SHEET_DISMISS_PX) {
        onExpandedChange(false);
      }
    } else if (offset <= -VOICE_LINE_SHEET_DISMISS_PX || Math.abs(offset) < VOICE_LINE_SHEET_TAP_PX) {
      onExpandedChange(true);
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffsetY(0);
    setDragging(false);
  }, [expanded, onExpandedChange]);

  const onHeadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.clientY;
    dragOffsetRef.current = 0;
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onHeadPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current == null) return;
    const deltaY = event.clientY - dragStartYRef.current;
    const nextOffset = expanded ? Math.max(0, deltaY) : Math.min(0, deltaY);
    dragOffsetRef.current = nextOffset;
    setDragOffsetY(nextOffset);
  };

  const panelStyle = (() => {
    if (dragging && expanded && dragOffsetY > 0) {
      return {
        maxHeight: `max(var(--voice-line-sheet-peek), calc(var(--voice-line-sheet-max) - ${dragOffsetY}px))`,
      } as React.CSSProperties;
    }
    if (dragging && !expanded && dragOffsetY < 0) {
      return {
        maxHeight: `min(var(--voice-line-sheet-max), calc(var(--voice-line-sheet-peek) + ${-dragOffsetY}px))`,
      } as React.CSSProperties;
    }
    return undefined;
  })();

  return (
    <div
      className={cn("voice-line-sheet", !expanded && "voice-line-sheet--collapsed")}
      role="dialog"
      aria-label="Управление репликой"
    >
      <div
        className={cn(
          "voice-line-sheet__panel",
          !expanded && !dragging && dragOffsetY === 0 && "voice-line-sheet__panel--collapsed",
          dragging && "voice-line-sheet__panel--dragging",
        )}
        style={panelStyle}
      >
        <div
          className="voice-line-sheet__head"
          aria-expanded={expanded}
          aria-label={expanded ? "Свернуть панель — потяните вниз" : "Развернуть панель — потяните вверх"}
          onPointerDown={onHeadPointerDown}
          onPointerMove={onHeadPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        />
        <div className="voice-line-sheet__scroll">{children}</div>
      </div>
    </div>
  );
}

function VoiceLineControlsPanel({
  className,
  current,
  sentenceTokens,
  sentenceIndex,
  showText,
  revealedLineIds,
  onToggleRevealLine,
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
  exercisesCount,
  onPrev,
  onNext,
  myTextNoRemarks,
}: VoiceLineControlsPanelProps) {
  const lineRevealed = Boolean(current.lineId && revealedLineIds.has(current.lineId));
  const showTarget = (showText || lineRevealed) && currentTarget;
  const isSheet = Boolean(className?.includes("voice-panel--sheet"));
  const sttBlocked = !supported.stt || (left === 0 && total > 0);

  const pttButton = (
    <button
      type="button"
      className={cn("voice-btn voice-ptt", isSheet && "voice-ptt--sheet")}
      data-active={listening ? "true" : "false"}
      disabled={sttBlocked}
      onPointerDown={(e) => {
        try {
          (e.currentTarget as HTMLElement & { setPointerCapture?: (id: number) => void })?.setPointerCapture?.(
            e.pointerId,
          );
        } catch {
          /* ignore */
        }
        e.preventDefault();
        pttStart();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        pttStop();
      }}
      onPointerCancel={() => pttStop()}
      title="Нажми и держи — идёт запись. Отпусти — проверим."
    >
      {listening ? "Запись…" : isSheet ? "Удерживайте" : "Нажми и держи"}
    </button>
  );

  const secondaryTools = (
    <>
      <VoiceIconButton
        label="Продолжить запись"
        title="Продолжить без сброса"
        disabled={sttBlocked}
        onClick={() => beginListeningSession({ resetTranscript: false })}
      >
        <svg {...voiceIconProps}>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
          <path d="M12 18v3" />
        </svg>
      </VoiceIconButton>
      {autoFlow ? (
        <VoiceIconButton
          label={autoCycleBusy ? "Остановить автоцикл" : "Автоцикл"}
          title={
            autoCycleBusy
              ? "Прервать озвучку и запись"
              : "Озвучить предыдущую и начать запись"
          }
          active={autoCycleBusy}
          disabled={sttBlocked && !autoCycleBusy}
          onClick={runAuto}
        >
          <svg {...voiceIconProps}>
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </VoiceIconButton>
      ) : null}
      {!showText ? (
        <VoiceIconButton
          label={lineRevealed ? "Скрыть реплику" : "Показать реплику"}
          active={lineRevealed}
          onClick={onToggleRevealLine}
        >
          {lineRevealed ? (
            <svg {...voiceIconProps}>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M1 1l22 22" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            </svg>
          ) : (
            <svg {...voiceIconProps}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </VoiceIconButton>
      ) : null}
      {lastTake ? (
        <>
          <VoiceIconButton
            label="Прослушать дубль"
            onClick={() => playUrl(lastTake.url, { label: "last-take" })}
          >
            <svg {...voiceIconProps}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </VoiceIconButton>
          <VoiceIconButton
            label="Сохранить как удачный дубль"
            disabled={voiceUpload.uploading || !projectName || !performerId}
            onClick={() => void saveLastTakeAsPreferred()}
          >
            <svg {...voiceIconProps}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
          </VoiceIconButton>
        </>
      ) : null}
    </>
  );

  return (
    <div className={cn("voice-panel", className)}>
      {sentenceTokens.length > 1 ? (
        <div className="voice-progress">
          Фраза: <b>{sentenceIndex + 1}</b> / {sentenceTokens.length}
        </div>
      ) : null}
      {showTarget ? (
        <div className="voice-target">
          “{String(currentTarget).slice(0, 160)}
          {String(currentTarget).length > 160 ? "…" : ""}”
        </div>
      ) : null}
      {(showText || lineRevealed) && lastAccepted ? (
        <div className="voice-muted">
          Засчитано: “{String(lastAccepted).slice(0, 120)}
          {String(lastAccepted).length > 120 ? "…" : ""}”
        </div>
      ) : null}

      {isSheet ? (
        <div className="voice-toolbar">
          {pttButton}
          <div className="voice-toolbar__row">
            <VoiceIconButton
              className="voice-icon-btn--nav"
              label="Предыдущая реплика"
              disabled={index <= 0}
              onClick={onPrev}
            >
              <svg {...voiceIconProps} width={16} height={16}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </VoiceIconButton>
            <div className="voice-toolbar__tools">{secondaryTools}</div>
            <VoiceIconButton
              className="voice-icon-btn--nav"
              label="Следующая реплика"
              disabled={index >= exercisesCount - 1}
              onClick={onNext}
            >
              <svg {...voiceIconProps} width={16} height={16}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </VoiceIconButton>
          </div>
          {voiceUpload.uploading ? (
            <div className="voice-toolbar__status">Сохраняю дубль…</div>
          ) : null}
        </div>
      ) : (
        <div className="voice-actions">
          {pttButton}
          <button
            type="button"
            className="voice-btn"
            disabled={sttBlocked}
            onClick={() => beginListeningSession({ resetTranscript: false })}
            title="Продолжить запись без сброса"
          >
            Продолжить
          </button>
          <button
            type="button"
            className={cn("voice-btn", autoCycleBusy && "voice-btn--primary")}
            disabled={sttBlocked && !autoCycleBusy}
            onClick={runAuto}
            title={
              autoCycleBusy
                ? "Прервать озвучку и запись"
                : "Озвучить предыдущую и начать запись"
            }
          >
            {autoCycleBusy ? "■ цикл" : "▶ цикл"}
          </button>
          {!showText ? (
            <button type="button" className="voice-btn" onClick={onToggleRevealLine}>
              {lineRevealed ? "Скрыть эту реплику" : "Показать эту реплику"}
            </button>
          ) : null}
          {lastTake ? (
            <>
              <button
                type="button"
                className="voice-btn"
                onClick={() => playUrl(lastTake.url, { label: "last-take" })}
                title="Прослушать последнюю запись"
              >
                ▶ дубль
              </button>
              <button
                type="button"
                className="voice-btn"
                disabled={voiceUpload.uploading || !projectName || !performerId}
                onClick={() => void saveLastTakeAsPreferred()}
                title="Сохранить последнюю запись как удачный дубль"
              >
                {voiceUpload.uploading ? "Сохраняю…" : "Сохранить как удачный"}
              </button>
            </>
          ) : null}
          <div className="voice-spacer" />
          <button type="button" className="voice-btn" disabled={index <= 0} onClick={onPrev}>
            ←
          </button>
          <button type="button" className="voice-btn" disabled={index >= exercisesCount - 1} onClick={onNext}>
            →
          </button>
        </div>
      )}

      {showText ? (
        <div className="voice-textbox">
          <div className="voice-text">{myTextNoRemarks || "—"}</div>
        </div>
      ) : null}

      {voiceUpload.error ? (
        <div className="voice-recognition">
          <div className="voice-result bad">{voiceUpload.error}</div>
        </div>
      ) : null}
    </div>
  );
}

export function VoiceDialogueTrainer({
  steps,
  role,
  roleKeys,
  selectedStepIds,
  storageKey,
  performerId,
  performerLabel,
}: {
  steps: ScriptStep[];
  role: string;
  roleKeys?: string[];
  selectedStepIds: number[];
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
  const voiceLines = useAppSelector((s) => s.scene.sceneData?.voiceLines);
  const voiceUpload = useAppSelector((s) => s.scene.voiceLinesUpload);

  useEffect(() => {
    dispatch(voiceTrainerUiActions.initVoiceTrainerUi({ uiKey }));
  }, [dispatch, uiKey]);
  const allLines = useMemo(() => {
    const selected = steps.filter((s) => selectedStepIds.includes(s.id));
    return buildDialogueLines({ steps: selected, preferField: "playMarkdown" });
  }, [selectedStepIds, steps]);

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
        // Use stable line id (stepId + line index) so progress survives text edits/cleanup.
        id: line.id,
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
  const isMobile = useIsMobile();
  const [lineSheetOpen, setLineSheetOpen] = useState(true);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isMobile && lineSheetOpen) return;
    const el = activeLineRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      // ignore
    }
  }, [current?.lineId, isMobile, lineSheetOpen]);

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

  if (!current) {
    return <div className="voice-empty">Нет реплик для голосового режима.</div>;
  }

  const prevText = current.prev?.text ? stripParentheses(current.prev.text) : "";
  const myTextNoRemarks = stripParentheses(current.textRaw);
  const prevLineId = current.prev?.lineId ?? "";
  const prevRoleKey = normalizeRoleKey(current.prev?.role ?? "");

  const speakPrev = (opts?: { onEnd?: () => void; onError?: () => void }) => {
    if (!prevText || !prevRoleKey || !prevLineId) {
      opts?.onEnd?.();
      return;
    }
    speakPartnerLine({ lineId: prevLineId, roleKey: prevRoleKey, text: prevText }, opts);
  };

  const saveLastTakeAsPreferred = async () => {
    if (!lastTake || !projectName) return;
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

  const skipPrevTtsForExerciseIdRef = useRef<string | null>(null);

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
    if (!current.lineId) return;
    setRevealedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(current.lineId)) next.delete(current.lineId);
      else next.add(current.lineId);
      return next;
    });
  };

  const lineControlsProps: VoiceLineControlsPanelProps = {
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
  };

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
    <div
      className={cn(
        "voice-trainer",
        isMobile && lineSheetOpen && "voice-trainer--sheet-open",
        isMobile && !lineSheetOpen && "voice-trainer--sheet-collapsed",
      )}
    >
      <div className="voice-head">
        <div className="voice-title">
          <b>{role || "—"}</b>
          {current?.stepTitle ? (
            <>
              <span className="voice-title__sep" aria-hidden="true">
                |
              </span>
              <span className="voice-step">{current.stepTitle}</span>
            </>
          ) : null}
        </div>
        <div className="voice-meta">
          Пройдено <b>{doneCount}</b> / {total} (осталось {left})
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

      <div className="voice-card">
        {allDoneDialog && total > 0 ? (
          <div className="voice-finished">
            <div className="voice-finished-title">Вы повторили весь текст.</div>
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

        <div className="voice-script">
          {(() =>
            allLines.map((line) => {
              if (line.kind === "stage") {
                return (
                  <div key={line.id} className="voice-line voice-line--stage">
                    <div className="voice-text">{line.text}</div>
                  </div>
                );
              }

              const lineRole = line.role ?? "—";
              const isMine = desiredRoleKeySet.has(normalizeRoleKey(lineRole));
              const exIdx = exerciseIndexByLineId.get(line.id);
              const ex = typeof exIdx === "number" ? exercises[exIdx] : null;
              const isDone = ex ? doneIds.has(ex.id) : false;
              const isActive = current?.lineId === line.id;

              return (
                <React.Fragment key={line.id}>
                  <div
                    ref={
                      isActive
                        ? (el) => {
                            activeLineRef.current = el;
                          }
                        : undefined
                    }
                    className={cn(
                      "voice-line",
                      isMine ? "voice-line--mine" : "voice-line--other",
                      isDone && "voice-line--done",
                      isActive && "voice-line--active",
                      isActive && isMine && listening && "voice-line--listening",
                      isMine && ex && "voice-line--clickable",
                    )}
                    onClick={() => {
                      if (!isMine || !ex) return;
                      setIndex(exIdx!);
                    }}
                    title={isMine && ex ? "Перейти к реплике" : undefined}
                  >
                    <div className="voice-role">{lineRole}</div>
                    {renderVoiceLineBody(line, {
                      isActive,
                      isMine,
                      showText,
                      revealedLineIds,
                      listening,
                      transcript,
                      interim,
                      result,
                      passRatioPercent,
                    })}
                  </div>

                  {isActive && !isMobile ? (
                    <VoiceLineControlsPanel {...lineControlsProps} className="voice-panel--inline" />
                  ) : null}
                </React.Fragment>
              );
            })
          )()}
        </div>
      </div>

      {isMobile ? (
        <VoiceLineSheet expanded={lineSheetOpen} onExpandedChange={setLineSheetOpen}>
          <VoiceLineControlsPanel {...lineControlsProps} className="voice-panel--sheet" />
        </VoiceLineSheet>
      ) : null}
    </div>

    <Modal
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      panelClassName="voice-settings-modal"
      ariaLabel="Настройки голосового тренажёра"
    >
      <div className="voice-settings-modal__head">
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

