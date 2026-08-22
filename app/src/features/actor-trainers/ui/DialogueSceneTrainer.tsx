import cn from "classnames";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Buttons } from "../../../shared/components/buttons/Buttons";
import type { ScriptScene } from "../../../shared/types/script";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import {
  shuffle,
  stripLeadingPunctuationTokens,
  tokenizeText,
  type WordToken,
} from "../model/wordTokens";
import { TrainerContextCard } from "./TrainerContextCard";
import "./dialogue-style.css";

const dialogueIconProps = {
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

function readDoneSet(storageKey?: string): Set<string> {
  if (!storageKey) return new Set<string>();
  if (typeof window === "undefined") return new Set<string>();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return new Set<string>();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((x) => String(x ?? "")).filter(Boolean));
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { doneIds?: unknown }).doneIds)) {
      return new Set(
        (parsed as { doneIds: unknown[] }).doneIds.map((x) => String(x ?? "")).filter(Boolean),
      );
    }
    return new Set<string>();
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

type Exercise = {
  id: string;
  lineId: string;
  sceneId: number;
  sceneTitle: string;
  role: string;
  text: string;
  target: WordToken[];
  shuffled: WordToken[];
};

function findNextUndone(exercises: Exercise[], done: Set<string>, fromIndex: number): number {
  if (exercises.length === 0) return 0;
  const start = Math.max(0, Math.min(fromIndex, exercises.length - 1));
  for (let offset = 0; offset < exercises.length; offset += 1) {
    const idx = (start + offset) % exercises.length;
    const ex = exercises[idx];
    if (!done.has(ex.id)) return idx;
  }
  return start;
}

const AUTO_WORDS = new Set<string>([
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

function isAutoToken(t: WordToken): boolean {
  if (t.kind === "punct") return true;
  if (t.kind === "word" && AUTO_WORDS.has(t.norm)) return true;
  return false;
}

function answerTokensForDisplay(answer: WordToken[]): WordToken[] {
  return stripLeadingPunctuationTokens(answer);
}

function joinAnswerTokens(tokens: WordToken[]): string {
  let out = "";
  for (const token of tokens) {
    if (!out) {
      out = token.text;
      continue;
    }
    if (token.kind === "punct") {
      out += token.text;
      continue;
    }
    out += ` ${token.text}`;
  }
  return out;
}

type PoolWordLabel = {
  leading: WordToken[];
  trailing: WordToken[];
};

function buildPoolWordLabels(target: WordToken[]): Map<string, PoolWordLabel> {
  const labels = new Map<string, PoolWordLabel>();
  let index = 0;
  const initialLeading: WordToken[] = [];

  while (index < target.length && isAutoToken(target[index]!)) {
    initialLeading.push(target[index]!);
    index += 1;
  }

  let isFirstContentWord = true;
  while (index < target.length) {
    const head = target[index]!;
    if (isAutoToken(head)) {
      index += 1;
      continue;
    }

    index += 1;
    const trailing: WordToken[] = [];
    while (index < target.length && isAutoToken(target[index]!)) {
      trailing.push(target[index]!);
      index += 1;
    }
    labels.set(head.id, {
      leading: isFirstContentWord ? initialLeading : [],
      trailing,
    });
    isFirstContentWord = false;
  }

  return labels;
}

function RoleLinePuzzle({
  ex,
  done,
  active,
  onDone,
  onResetDone,
  wordPoolHost,
}: {
  ex: Exercise;
  done: boolean;
  active: boolean;
  onDone: () => void;
  onResetDone: () => void;
  wordPoolHost: HTMLElement | null;
}) {
  const [pool, setPool] = useState<WordToken[]>(ex.shuffled);
  const [answer, setAnswer] = useState<WordToken[]>([]);
  const [mistake, setMistake] = useState(false);
  const [mistakeStreak, setMistakeStreak] = useState(0);
  const completedFiredRef = useRef(false);
  const poolRef = useRef<WordToken[]>(pool);
  const answerRef = useRef<WordToken[]>(answer);

  const resetState = () => {
    setAnswer([]);
    setPool((ex.shuffled ?? []).filter((t) => !isAutoToken(t)));
    setMistake(false);
    setMistakeStreak(0);
    completedFiredRef.current = false;
  };

  useEffect(() => {
    if (done) return;
    resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, done]);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const nextExpectedToken = (() => {
    let idx = answer.length;
    while (idx < ex.target.length && isAutoToken(ex.target[idx]!)) {
      idx += 1;
    }
    return ex.target[idx] ?? null;
  })();

  const showHint = mistakeStreak >= 3 && nextExpectedToken != null;

  const pick = (token: WordToken) => {
    const poolNow = poolRef.current;
    const answerNow = answerRef.current;
    setMistake(false);

    let idx = answerNow.length;
    const leadingAutos: WordToken[] = [];
    while (idx < ex.target.length && isAutoToken(ex.target[idx]!)) {
      leadingAutos.push(ex.target[idx]!);
      idx += 1;
    }

    const expected = ex.target[idx] ?? null;
    if (!expected || isAutoToken(expected)) return;

    const ok = token.norm === expected.norm;
    if (!ok) {
      setMistake(true);
      setMistakeStreak((count) => count + 1);
      return;
    }

    const nextPool = poolNow.filter((t) => t.id !== token.id);
    const nextAnswer: WordToken[] = [...answerNow, ...leadingAutos, token];
    idx += 1;

    while (idx < ex.target.length && isAutoToken(ex.target[idx]!)) {
      nextAnswer.push(ex.target[idx]!);
      idx += 1;
    }

    setPool(nextPool);
    setAnswer(nextAnswer);
    setMistakeStreak(0);
  };

  useEffect(() => {
    if (answer.length !== ex.target.length) return;
    if (ex.target.length === 0) return;
    if (completedFiredRef.current) return;
    completedFiredRef.current = true;
    // Completed (once)
    const t = window.setTimeout(() => onDone(), 150);
    return () => window.clearTimeout(t);
  }, [answer.length, ex.target.length, onDone]);

  if (done) {
    return (
      <>
        <div className="dialogue-role">{ex.role}</div>
        <div className="dialogue-text">{ex.text}</div>
        <Buttons.TextButton type="button" className="dialogue-undone-btn" onClick={onResetDone}>
          не пройдено
        </Buttons.TextButton>
      </>
    );
  }

  if (!active) {
    return (
      <>
        <div className="dialogue-role">{ex.role}</div>
        <div className="dialogue-text dialogue-text--upcoming">
          <span className="dialogue-upcoming-mark" aria-hidden="true">
            ···
          </span>
          <span className="dialogue-muted">ваша реплика дальше</span>
        </div>
      </>
    );
  }

  const visibleAnswer = answerTokensForDisplay(answer);
  const hasAnswer = visibleAnswer.length > 0;
  const poolWordLabels = buildPoolWordLabels(ex.target);
  const hintTokenId = showHint
    ? pool.find((token) => token.id === nextExpectedToken?.id)?.id ??
      pool.find((token) => token.norm === nextExpectedToken?.norm)?.id ??
      null
    : null;

  const wordPool = (
    <div className="dialogue-pool" aria-label="Слова реплики">
      {pool.map((t) => {
        const label = poolWordLabels.get(t.id);
        const leading = label?.leading ?? [];
        const trailing = label?.trailing ?? [];
        const isHint = hintTokenId != null && t.id === hintTokenId;
        return (
          <button
            key={t.id}
            type="button"
            className={cn(
              "dialogue-token",
              t.kind === "punct" && "dialogue-token--punct",
              isHint && "dialogue-token--hint",
            )}
            onClick={() => pick(t)}
          >
            {leading.map((autoToken) => (
              <span
                key={autoToken.id}
                className={cn(
                  "dialogue-token__auto",
                  "dialogue-token__auto--leading",
                  autoToken.kind === "punct" && "dialogue-token__auto--punct",
                )}
              >
                {autoToken.text}
              </span>
            ))}
            <span className="dialogue-token__head">{t.text}</span>
            {trailing.map((autoToken) => (
              <span
                key={autoToken.id}
                className={cn(
                  "dialogue-token__auto",
                  autoToken.kind === "punct" && "dialogue-token__auto--punct",
                )}
              >
                {autoToken.text}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="dialogue-my-line" data-done="false" data-mistake={mistake ? "true" : "false"}>
        <div className="dialogue-my-line-head">
          <div className="dialogue-my-line-role-row">
            <div className="dialogue-my-line-role">{ex.role}</div>
            <span className="dialogue-now-badge">Сейчас</span>
          </div>
          <div className="dialogue-my-line-actions">
            <Buttons.TextButton
              type="button"
              className="dialogue-reset-btn"
              onClick={() => {
                resetState();
              }}
            >
              сбросить
            </Buttons.TextButton>
          </div>
        </div>

        <div className={cn("dialogue-answer", !hasAnswer && "dialogue-answer--empty")}>
          {hasAnswer ? (
            <span>{joinAnswerTokens(visibleAnswer)}</span>
          ) : (
            <span className="dialogue-muted">Соберите реплику по словам</span>
          )}
        </div>

        {mistake ? (
          <div className="dialogue-mistake" role="status">
            Не то слово — попробуйте ещё
          </div>
        ) : null}
      </div>
      {wordPoolHost ? createPortal(wordPool, wordPoolHost) : null}
    </>
  );
}

export function DialogueSceneTrainer({
  scenes,
  role,
  roleKeys,
  roleInfo,
  projectRoles,
  accessToken,
  selectedPlaybookIds,
  storageKey,
}: {
  scenes: ScriptScene[];
  role: string;
  roleKeys?: string[];
  roleInfo: ProjectRoleInfo | null;
  projectRoles: ProjectRoleInfo[];
  accessToken?: string | null;
  selectedPlaybookIds: number[];
  storageKey?: string;
}) {
  const allLines = useMemo(() => {
    const selected = scenes.filter((s) => selectedPlaybookIds.includes(s.id));
    return buildDialogueLines({ scenes: selected, preferField: "playMarkdown" });
  }, [selectedPlaybookIds, scenes]);

  const desiredRoleKeySet = useMemo(() => {
    const keys = (roleKeys && roleKeys.length ? roleKeys : [role])
      .map((x) => normalizeRoleKey(String(x ?? "")))
      .filter(Boolean);
    return new Set(keys);
  }, [role, roleKeys]);

  const exercises = useMemo(() => {
    const out: Exercise[] = [];
    for (const line of allLines) {
      if (line.kind !== "utterance") continue;
      if (!line.role) continue;
      if (!desiredRoleKeySet.has(normalizeRoleKey(line.role))) continue;
      const tokens = stripLeadingPunctuationTokens(
        tokenizeText(line.text, { includePunctuation: true }),
      );
      if (tokens.length < 1) continue;
      const seed = Number(String(line.sceneId ?? 0)) + line.text.length * 17;
      out.push({
        // Use stable line id so progress survives text edits/cleanup.
        id: line.id,
        lineId: line.id,
        sceneId: line.sceneId,
        sceneTitle: line.sceneTitle,
        role: line.role,
        text: line.text,
        target: tokens,
        shuffled: shuffle(tokens, seed),
      });
    }
    return out;
  }, [allLines, desiredRoleKeySet]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
  const [hideUnspokenText, setHideUnspokenText] = useState(true);
  const [wordPoolHost, setWordPoolHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setDoneIds(readDoneSet(storageKey));
  }, [storageKey]);

  const doneCount = useMemo(() => {
    let c = 0;
    for (const ex of exercises) if (doneIds.has(ex.id)) c += 1;
    return c;
  }, [doneIds, exercises]);

  const total = exercises.length;
  const left = Math.max(0, total - doneCount);
  const allDone = total > 0 && left === 0;

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  useEffect(() => {
    setActiveExerciseIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  // «Сейчас» — всегда первая непройденная (не зависший индекс 0 после reload)
  useEffect(() => {
    if (allDone || exercises.length === 0) return;
    const current = exercises[activeExerciseIndex];
    if (current && !doneIds.has(current.id)) return;
    const next = findNextUndone(exercises, doneIds, 0);
    if (next !== activeExerciseIndex) setActiveExerciseIndex(next);
  }, [allDone, activeExerciseIndex, doneIds, exercises]);

  const activeExerciseIndexResolved = useMemo(() => {
    if (allDone) return activeExerciseIndex;
    const current = exercises[activeExerciseIndex];
    if (current && !doneIds.has(current.id)) return activeExerciseIndex;
    return findNextUndone(exercises, doneIds, 0);
  }, [activeExerciseIndex, allDone, doneIds, exercises]);

  const activeExercise = exercises[activeExerciseIndexResolved] ?? null;
  const lineBeforeActive = useMemo(() => {
    if (!activeExercise) return null;

    const activeLineIndex = allLines.findIndex((line) => line.id === activeExercise.lineId);
    if (activeLineIndex < 0) return null;

    return (
      allLines
        .slice(0, activeLineIndex)
        .reverse()
        .find(
          (line) =>
            line.kind === "utterance" && line.sceneId === activeExercise.sceneId,
        ) ?? null
    );
  }, [activeExercise, allLines]);

  const exerciseByLineId = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const exercise of exercises) {
      map.set(exercise.lineId, exercise);
    }
    return map;
  }, [exercises]);

  const scriptLineRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!activeExercise) return;
    const lineEl = scriptLineRefs.current.get(activeExercise.lineId);
    if (!lineEl) return;
    lineEl.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeExercise?.lineId]);

  const markDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDoneSet(storageKey, next);
      setActiveExerciseIndex((i) => findNextUndone(exercises, next, i + 1));
      return next;
    });
  };

  const markUndone = (id: string) => {
    const next = new Set(doneIds);
    next.delete(id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
  };

  const goPrevMyLine = () => {
    if (!activeExercise) return;
    setActiveExerciseIndex((i) => Math.max(0, i - 1));
  };

  const goNextMyLine = () => {
    if (!activeExercise) return;
    setActiveExerciseIndex((i) => Math.min(exercises.length - 1, i + 1));
  };

  const goNextUndone = () => {
    setActiveExerciseIndex((i) => findNextUndone(exercises, doneIds, i + 1));
  };

  const jumpToExercise = (lineId: string) => {
    const exerciseIndex = exercises.findIndex((exercise) => exercise.lineId === lineId);
    if (exerciseIndex < 0) return;
    setActiveExerciseIndex(exerciseIndex);
  };

  const showLearningStage = !allDone && Boolean(activeExercise);
  const showScriptStrip = allLines.length > 0;
  const activeScriptLineIndex = activeExercise
    ? allLines.findIndex((line) => line.id === activeExercise.lineId)
    : -1;

  return (
    <div className="dialogue-trainer" data-all-done={allDone ? "true" : "false"}>
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
              <svg {...dialogueIconProps}>
                <path d="M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.2-5.7" />
                <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.7 3.8" />
                <path d="M14.1 9.9a3 3 0 0 1-4.2 4.2" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg {...dialogueIconProps}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="dialogue-icon-btn"
            onClick={goPrevMyLine}
            disabled={activeExerciseIndex <= 0}
            aria-label="Предыдущая моя реплика"
            title="Предыдущая моя реплика"
          >
            <svg {...dialogueIconProps}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="dialogue-icon-btn"
            onClick={goNextMyLine}
            disabled={activeExerciseIndex >= exercises.length - 1}
            aria-label="Следующая моя реплика"
            title="Следующая моя реплика"
          >
            <svg {...dialogueIconProps}>
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
            <svg {...dialogueIconProps}>
              <path d="M5 12h10" />
              <path d="M13 6l6 6-6 6" />
              <path d="M5 6v12" />
            </svg>
          </button>
          {storageKey ? (
            <button
              type="button"
              className="dialogue-icon-btn dialogue-icon-btn--danger"
              onClick={() => {
                const confirmed = window.confirm("Сбросить прогресс диалогового тренажёра для этой роли?");
                if (!confirmed) return;
                const next = new Set<string>();
                setDoneIds(next);
                persistDoneSet(storageKey, next);
                setActiveExerciseIndex(0);
              }}
              aria-label="Сброс прогресса"
              title="Сброс прогресса"
            >
              <svg {...dialogueIconProps}>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="dialogue-scroll">
        {allDone ? (
          <div className="dialogue-finished" role="status">
            <div className="dialogue-finished-title">Все реплики пройдены</div>
            <div className="dialogue-finished-meta">
              Вы успешно собрали все фразы выбранных сцен. Можно пройти ещё раз или сбросить прогресс.
            </div>
          </div>
        ) : null}
        {allLines.length === 0 ? (
          <div className="dialogue-empty">
            {selectedPlaybookIds.length === 0
              ? "Выберите сцены в настройках. Если список пуст, выберите роль, у которой есть реплики в тексте."
              : "Нет текста в выбранных сценах (проверьте поле «Текст» в сценах)."}
          </div>
        ) : showLearningStage && activeExercise ? (
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
                      title: role || activeExercise.role || "Моя роль",
                      avatarKey: null,
                    }
                  }
                  accessToken={accessToken}
                  size="md"
                  className="dialogue-self-card__portrait"
                />
              </div>

              <div className="dialogue-self-card__exercise">
                <RoleLinePuzzle
                  ex={activeExercise}
                  done={false}
                  active
                  wordPoolHost={wordPoolHost}
                  onDone={() => markDone(activeExercise.id)}
                  onResetDone={() => markUndone(activeExercise.id)}
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {showLearningStage ? (
        <div
          ref={setWordPoolHost}
          className="dialogue-word-dock"
          aria-label="Слова для текущей реплики"
        />
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
              const exercise = exerciseByLineId.get(line.id) ?? null;
              const isMine = Boolean(exercise);
              const isActive = Boolean(activeExercise && activeExercise.lineId === line.id);
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
                {activeExercise ? (
                  <>
                    {" "}
                    · сейчас реплика <b>{activeExerciseIndexResolved + 1}</b>
                  </>
                ) : null}
              </>
            )}
          </div>
          {activeExercise?.sceneTitle ? (
            <div className="dialogue-toolbar-scene">
              Сцена <b>{activeExercise.sceneTitle}</b>
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

