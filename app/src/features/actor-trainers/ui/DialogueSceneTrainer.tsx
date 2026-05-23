import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ScriptStep } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import { shuffle, tokenizeText, type WordToken } from "../model/wordTokens";
import "./dialogue-style.css";

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
  stepId: number;
  stepTitle: string;
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

function RoleLinePuzzle({
  ex,
  done,
  active,
  onDone,
  onResetDone,
}: {
  ex: Exercise;
  done: boolean;
  active: boolean;
  onDone: () => void;
  onResetDone: () => void;
}) {
  const [pool, setPool] = useState<WordToken[]>(ex.shuffled);
  const [answer, setAnswer] = useState<WordToken[]>([]);
  const [mistake, setMistake] = useState(false);
  const completedFiredRef = useRef(false);
  const poolRef = useRef<WordToken[]>(pool);
  const answerRef = useRef<WordToken[]>(answer);

  const resetState = () => {
    const target = ex.target ?? [];
    const autoPrefix: WordToken[] = [];
    let i = 0;
    while (i < target.length && isAutoToken(target[i]!)) {
      autoPrefix.push(target[i]!);
      i += 1;
    }
    setAnswer(autoPrefix);
    setPool((ex.shuffled ?? []).filter((t) => !isAutoToken(t)));
    setMistake(false);
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

  const expected = ex.target[answer.length] ?? null;

  const pick = (token: WordToken) => {
    const poolNow = poolRef.current;
    const answerNow = answerRef.current;
    const expected = ex.target[answerNow.length] ?? null;
    if (!expected) return;
    // Ошибка должна "висеть" до следующего клика — сбрасываем на новом клике.
    setMistake(false);
    const ok = token.norm === expected.norm;
    if (!ok) {
      setMistake(true);
      return;
    }

    let nextPool = poolNow.filter((t) => t.id !== token.id);
    const nextAnswer: WordToken[] = [...answerNow, token];

    // Автоподстановка: после верного слова автоматически добавляем
    // идущие подряд частицы/союзы/предлоги и (опционально) пунктуацию.
    let idx = nextAnswer.length;
    while (idx < ex.target.length) {
      const want = ex.target[idx];
      if (!want) break;
      if (!isAutoToken(want)) break;
      nextAnswer.push(want);
      idx += 1;
    }

    setPool(nextPool);
    setAnswer(nextAnswer);
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
      <div className="dialogue-my-line" data-done="true" data-mistake="false">
        <div className="dialogue-my-line-head">
          <div className="dialogue-my-line-role-row">
            <div className="dialogue-my-line-role">{ex.role}</div>
            {active ? <span className="dialogue-now-badge">Сейчас</span> : null}
          </div>
          <div className="dialogue-my-line-actions">
            <button type="button" className="dialogue-btn" onClick={onResetDone}>
              “не пройдено”
            </button>
          </div>
        </div>
        <div className="dialogue-answer dialogue-answer--done">
          <span>{ex.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dialogue-my-line" data-done="false" data-mistake={mistake ? "true" : "false"}>
      <div className="dialogue-my-line-head">
        <div className="dialogue-my-line-role-row">
          <div className="dialogue-my-line-role">{ex.role}</div>
          {active ? <span className="dialogue-now-badge">Сейчас</span> : null}
        </div>
        <div className="dialogue-my-line-actions">
          <button
            type="button"
            className="dialogue-btn"
            onClick={() => {
              resetState();
            }}
          >
            сбросить
          </button>
        </div>
      </div>

      <div className="dialogue-answer">
        {answer.length === 0 ? (
          <span className="dialogue-muted">кликай слова по порядку…</span>
        ) : (
          <span>{answer.map((t) => t.text).join(" ")}</span>
        )}
      </div>

      <div className="dialogue-pool">
        {pool.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dialogue-token dialogue-token--${t.kind}`}
            onClick={() => pick(t)}
          >
            {t.text}
          </button>
        ))}
      </div>

      {mistake ? (
        <div className="dialogue-mistake">
          Неверно. Следующее слово: <b>{expected?.text}</b>
        </div>
      ) : null}
    </div>
  );
}

export function DialogueSceneTrainer({
  steps,
  role,
  roleKeys,
  selectedStepIds,
  storageKey,
}: {
  steps: ScriptStep[];
  role: string;
  roleKeys?: string[];
  selectedStepIds: number[];
  storageKey?: string;
}) {
  const allLines = useMemo(() => {
    const selected = steps.filter((s) => selectedStepIds.includes(s.id));
    return buildDialogueLines({ steps: selected, preferField: "playMarkdown" });
  }, [selectedStepIds, steps]);

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
      const tokens = tokenizeText(line.text, { includePunctuation: true });
      if (tokens.length < 1) continue;
      const seed = Number(String(line.stepId ?? 0)) + line.text.length * 17;
      out.push({
        // Use stable line id so progress survives text edits/cleanup.
        id: line.id,
        lineId: line.id,
        stepId: line.stepId,
        stepTitle: line.stepTitle,
        role: line.role,
        text: line.text,
        target: tokens,
        shuffled: shuffle(tokens, seed),
      });
    }
    return out;
  }, [allLines, desiredRoleKeySet]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
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

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  useEffect(() => {
    setActiveExerciseIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  const activeExercise = exercises[activeExerciseIndex] ?? null;

  const lineRefs = useRef(new Map<string, HTMLDivElement>());
  const setLineRef = (id: string, el: HTMLDivElement | null) => {
    if (!el) return;
    lineRefs.current.set(id, el);
  };

  useEffect(() => {
    if (!activeExercise) return;
    const el = lineRefs.current.get(activeExercise.lineId);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeExercise?.lineId]);

  const markDone = (id: string) => {
    const next = new Set(doneIds);
    next.add(id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    setActiveExerciseIndex((i) => findNextUndone(exercises, next, i + 1));
  };

  const markUndone = (id: string) => {
    const next = new Set(doneIds);
    next.delete(id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
  };

  const goPrevMyLine = () => {
    if (!activeExercise) return;
    for (let i = Math.max(0, activeExerciseIndex - 1); i >= 0; i -= 1) {
      setActiveExerciseIndex(i);
      return;
    }
  };

  const goNextMyLine = () => {
    if (!activeExercise) return;
    if (activeExerciseIndex < exercises.length - 1) setActiveExerciseIndex(activeExerciseIndex + 1);
  };

  const goNextUndone = () => {
    setActiveExerciseIndex((i) => findNextUndone(exercises, doneIds, i + 1));
  };

  const renderLine = (line: DialogueLine) => {
    if (line.kind === "stage") {
      return (
        <div className="dialogue-stage">
          <span>{line.text}</span>
        </div>
      );
    }

    const roleLabel = line.role ? String(line.role) : "—";
    const isMine = line.role && desiredRoleKeySet.has(normalizeRoleKey(line.role));
    if (!isMine) {
      return (
        <div className="dialogue-line">
          <div className="dialogue-role">{roleLabel}</div>
          <div className="dialogue-text">{line.text}</div>
        </div>
      );
    }

    const ex = exercises.find((e) => e.lineId === line.id) ?? null;
    if (!ex) {
      return (
        <div className="dialogue-line dialogue-line--mine">
          <div className="dialogue-role">{roleLabel}</div>
          <div className="dialogue-text">{line.text}</div>
        </div>
      );
    }

    const isActive = activeExercise?.lineId === line.id;
    const done = doneIds.has(ex.id);

    return (
      <div className={`dialogue-line dialogue-line--mine ${isActive ? "dialogue-line--active" : ""}`}>
        <RoleLinePuzzle
          ex={ex}
          done={done}
          active={isActive}
          onDone={() => {
            markDone(ex.id);
          }}
          onResetDone={() => markUndone(ex.id)}
        />
      </div>
    );
  };

  return (
    <div className="dialogue-trainer">
      <div className="dialogue-toolbar">
        <div className="dialogue-toolbar-main">
          <div className="dialogue-toolbar-title">
            Диалоговый тренажёр — роль <b>{role || "—"}</b>
          </div>
          <div className="dialogue-toolbar-meta">
            Пройдено <b>{doneCount}</b> / {total} (осталось {left})
            {activeExercise ? (
              <>
                {" "}
                · сейчас реплика <b>{activeExerciseIndex + 1}</b> / {total}
              </>
            ) : null}
          </div>
        </div>
        <div className="dialogue-toolbar-actions">
          <button type="button" className="dialogue-btn" onClick={goPrevMyLine} disabled={activeExerciseIndex <= 0}>
            ← моя реплика
          </button>
          <button type="button" className="dialogue-btn" onClick={goNextMyLine} disabled={activeExerciseIndex >= exercises.length - 1}>
            моя реплика →
          </button>
          <button type="button" className="dialogue-btn dialogue-btn--primary" onClick={goNextUndone} disabled={left === 0}>
            следующая непройденная
          </button>
          {storageKey ? (
            <button
              type="button"
              className="dialogue-btn"
              onClick={() => {
                const confirmed = window.confirm("Сбросить прогресс диалогового тренажёра для этой роли?");
                if (!confirmed) return;
                const next = new Set<string>();
                setDoneIds(next);
                persistDoneSet(storageKey, next);
                setActiveExerciseIndex(0);
              }}
            >
              сброс прогресса
            </button>
          ) : null}
        </div>
      </div>

      <div className="dialogue-scroll">
        {allLines.length === 0 ? (
          <div className="dialogue-empty">
            {selectedStepIds.length === 0
              ? "Выберите шаги для тренировки в настройках выше."
              : "Нет текста в выбранных шагах (проверьте поле «Текст» в шагах)."}
          </div>
        ) : (
          allLines.map((line) => (
            <div
              key={line.id}
              ref={(el) => setLineRef(line.id, el)}
              className="dialogue-line-wrap"
              data-step-id={String(line.stepId)}
            >
              {renderLine(line)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

