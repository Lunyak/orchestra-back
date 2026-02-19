import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ScriptStep } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import { shuffle, tokenizeText, type WordToken } from "../model/wordTokens";
import "./dialogue-style.css";

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

function RoleLinePuzzle({
  ex,
  done,
  includePunctuation,
  onDone,
  onResetDone,
}: {
  ex: Exercise;
  done: boolean;
  includePunctuation: boolean;
  onDone: () => void;
  onResetDone: () => void;
}) {
  const [pool, setPool] = useState<WordToken[]>(ex.shuffled);
  const [answer, setAnswer] = useState<WordToken[]>([]);
  const [mistake, setMistake] = useState(false);

  useEffect(() => {
    setPool(ex.shuffled);
    setAnswer([]);
    setMistake(false);
  }, [ex.id, includePunctuation]);

  const expected = ex.target[answer.length] ?? null;

  const pick = (token: WordToken) => {
    if (!expected) return;
    const ok = token.norm === expected.norm;
    if (!ok) {
      setMistake(true);
      window.setTimeout(() => setMistake(false), 220);
      return;
    }
    setPool((prev) => prev.filter((t) => t.id !== token.id));
    setAnswer((prev) => [...prev, token]);
  };

  useEffect(() => {
    if (answer.length !== ex.target.length) return;
    if (ex.target.length === 0) return;
    // Completed
    const t = window.setTimeout(() => onDone(), 250);
    return () => window.clearTimeout(t);
  }, [answer.length, ex.target.length, onDone]);

  return (
    <div className="dialogue-my-line" data-done={done ? "true" : "false"} data-mistake={mistake ? "true" : "false"}>
      <div className="dialogue-my-line-head">
        <div className="dialogue-my-line-role">{ex.role}</div>
        <div className="dialogue-my-line-actions">
          {done ? (
            <button type="button" className="dialogue-btn" onClick={onResetDone}>
              отметить как “не пройдено”
            </button>
          ) : null}
          <button
            type="button"
            className="dialogue-btn"
            onClick={() => {
              setPool(ex.shuffled);
              setAnswer([]);
              setMistake(false);
            }}
          >
            сбросить реплику
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
  selectedStepIds,
  storageKey,
}: {
  steps: ScriptStep[];
  role: string;
  selectedStepIds: number[];
  storageKey?: string;
}) {
  const [includePunctuation, setIncludePunctuation] = useState(true);

  const allLines = useMemo(() => {
    const selected = steps.filter((s) => selectedStepIds.includes(s.id));
    return buildDialogueLines({ steps: selected, preferField: "playMarkdown" });
  }, [selectedStepIds, steps]);

  const roleKey = normalizeRoleKey(role);

  const exercises = useMemo(() => {
    const out: Exercise[] = [];
    for (const line of allLines) {
      if (line.kind !== "utterance") continue;
      if (!line.role) continue;
      if (normalizeRoleKey(line.role) !== roleKey) continue;
      const tokens = tokenizeText(line.text, { includePunctuation });
      if (tokens.length < 1) continue;
      const seed = Number(String(line.stepId ?? 0)) + line.text.length * 17;
      out.push({
        id: `${line.stepId}:${line.role}:${line.text}`,
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
  }, [allLines, includePunctuation, roleKey]);

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
  useEffect(() => {
    setActiveExerciseIndex((i) => findNextUndone(exercises, doneIds, i));
  }, [doneIds, exercises]);

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
    const isMine = line.role && normalizeRoleKey(line.role) === roleKey;
    if (!isMine || !activeExercise) {
      return (
        <div className={`dialogue-line ${isMine ? "dialogue-line--mine" : ""}`}>
          <div className="dialogue-role">{roleLabel}</div>
          <div className="dialogue-text">{line.text}</div>
        </div>
      );
    }

    const ex =
      exercises.find((e) => e.lineId === line.id) ??
      null;
    if (!ex) {
      return (
        <div className="dialogue-line dialogue-line--mine">
          <div className="dialogue-role">{roleLabel}</div>
          <div className="dialogue-text">{line.text}</div>
        </div>
      );
    }

    const isActive = activeExercise.lineId === line.id;
    const done = doneIds.has(ex.id);

    return (
      <div className={`dialogue-line dialogue-line--mine ${isActive ? "dialogue-line--active" : ""}`}>
        <RoleLinePuzzle
          ex={ex}
          done={done}
          includePunctuation={includePunctuation}
          onDone={() => {
            markDone(ex.id);
            goNextUndone();
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
          </div>
        </div>
        <div className="dialogue-toolbar-actions">
          <label className="dialogue-chip">
            <input
              type="checkbox"
              checked={includePunctuation}
              onChange={(e) => setIncludePunctuation(e.target.checked)}
            />
            пунктуация
          </label>
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
              }}
            >
              сброс прогресса
            </button>
          ) : null}
        </div>
      </div>

      <div className="dialogue-scroll">
        {allLines.length === 0 ? (
          <div className="dialogue-empty">Нет текста в выбранных шагах.</div>
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

