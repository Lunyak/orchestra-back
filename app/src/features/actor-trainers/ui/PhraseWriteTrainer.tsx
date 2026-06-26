import cn from "classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import { Buttons } from "../../../shared/components/buttons/Buttons";
import type { ScriptScene } from "../../../shared/types/script";
import { buildDialogueLines, normalizeRoleKey, type DialogueLine } from "../model/dialogue";
import {
  DEFAULT_PHRASE_PASS_RATIO_PERCENT,
  normalizePassRatioPercent,
  PHRASE_PASS_RATIO_OPTIONS,
  scorePhraseText,
  stripParentheses,
  type PhrasePassRatioPercent,
  type PhraseWordIssue,
} from "../model/phraseTextMatch";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import "./dialogue-style.css";

type Exercise = {
  id: string;
  lineId: string;
  sceneId: number;
  sceneTitle: string;
  role: string;
  text: string;
  textForCheck: string;
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

function readPassRatio(storageKey?: string): PhrasePassRatioPercent {
  if (!storageKey || typeof window === "undefined") return DEFAULT_PHRASE_PASS_RATIO_PERCENT;
  return normalizePassRatioPercent(localStorage.getItem(`${storageKey}:passRatioPercent`));
}

function persistPassRatio(storageKey: string | undefined, value: PhrasePassRatioPercent) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${storageKey}:passRatioPercent`, String(value));
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

function formatWordIssue(issue: PhraseWordIssue): string {
  if (issue.kind === "wrong") {
    return `«${issue.typed ?? "…"}» вместо «${issue.expected ?? "…"}»`;
  }
  if (issue.kind === "missing") {
    return `пропущено «${issue.expected ?? "…"}»`;
  }
  return `лишнее «${issue.typed ?? "…"}»`;
}

function RoleLineWrite({
  ex,
  done,
  active,
  passRatioPercent,
  onDone,
  onResetDone,
}: {
  ex: Exercise;
  done: boolean;
  active: boolean;
  passRatioPercent: PhrasePassRatioPercent;
  onDone: () => void;
  onResetDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [checked, setChecked] = useState<null | { ok: boolean; ratio: number; issues: PhraseWordIssue[] }>(
    null,
  );

  useEffect(() => {
    setDraft("");
    setChecked(null);
  }, [ex.id, done]);

  const onCheck = () => {
    const result = scorePhraseText(ex.textForCheck, draft, passRatioPercent);
    setChecked({ ok: result.ok, ratio: result.ratio, issues: result.issues });
    if (result.ok) onDone();
  };

  const canCheck = draft.trim().length > 0;

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

  return (
    <div
      className="dialogue-my-line dialogue-my-line--write"
      data-done="false"
      data-mistake={checked?.ok === false ? "true" : "false"}
    >
      <div className="dialogue-my-line-head">
        <div className="dialogue-my-line-role-row">
          <div className="dialogue-my-line-role">{ex.role}</div>
          {active ? <span className="dialogue-now-badge">Сейчас</span> : null}
        </div>
        <div className="dialogue-my-line-actions">
          <Buttons.TextButton
            type="button"
            className="dialogue-reset-btn"
            onClick={() => {
              setDraft("");
              setChecked(null);
            }}
          >
            очистить
          </Buttons.TextButton>
        </div>
      </div>

      <textarea
        className={cn(
          "dialogue-write-input",
          checked?.ok === true && "dialogue-write-input--ok",
          checked?.ok === false && "dialogue-write-input--bad",
        )}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setChecked(null);
        }}
        rows={3}
        placeholder="Напишите реплику по памяти…"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canCheck) {
            e.preventDefault();
            onCheck();
          }
        }}
      />

      <div className="dialogue-write-actions">
        <button type="button" className="dialogue-btn dialogue-btn--primary" disabled={!canCheck} onClick={onCheck}>
          проверить
        </button>
        <span className="dialogue-muted">Ctrl+Enter</span>
      </div>

      {checked ? (
        <div className={cn("dialogue-write-result", checked.ok && "dialogue-write-result--ok")}>
          {checked.ok ? "Верно." : `Пока не так (нужно ≥${passRatioPercent}%).`} Точность:{" "}
          <b>{Math.round(checked.ratio * 100)}%</b>
          {!checked.ok && checked.issues.length > 0 ? (
            <ul className="dialogue-write-issues">
              {checked.issues.map((issue, idx) => (
                <li key={`${issue.kind}-${issue.expected ?? issue.typed ?? idx}`}>{formatWordIssue(issue)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PhraseWriteTrainer({
  scenes,
  role,
  roleKeys,
  selectedPlaybookIds,
  storageKey,
}: {
  scenes: ScriptScene[];
  role: string;
  roleKeys?: string[];
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
      const textForCheck = stripParentheses(line.text).trim();
      if (!textForCheck) continue;
      out.push({
        id: line.id,
        lineId: line.id,
        sceneId: line.sceneId,
        sceneTitle: line.sceneTitle,
        role: line.role,
        text: line.text,
        textForCheck,
      });
    }
    return out;
  }, [allLines, desiredRoleKeySet]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
  const [passRatioPercent, setPassRatioPercent] = useState<PhrasePassRatioPercent>(() =>
    readPassRatio(storageKey),
  );

  useEffect(() => {
    setDoneIds(readDoneSet(storageKey));
    setPassRatioPercent(readPassRatio(storageKey));
  }, [storageKey]);

  const passRatioOptions = useMemo(
    () =>
      PHRASE_PASS_RATIO_OPTIONS.map((value) => ({
        value: String(value),
        label: `${value}%`,
      })),
    [],
  );

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

  const lineRefs = useRef(new Map<string, HTMLDivElement>());
  const setLineRef = (id: string, el: HTMLDivElement | null) => {
    if (!el) lineRefs.current.delete(id);
    else lineRefs.current.set(id, el);
  };

  useEffect(() => {
    if (!activeExercise) return;
    const el = lineRefs.current.get(activeExercise.lineId);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
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
        <div className="dialogue-line dialogue-line--other">
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

    const done = doneIds.has(ex.id);
    const isActive = !allDone && !done && activeExercise?.lineId === line.id;

    return (
      <div
        className={cn(
          "dialogue-line",
          "dialogue-line--mine",
          done && "dialogue-line--done",
          isActive && "dialogue-line--active",
        )}
      >
        <RoleLineWrite
          ex={ex}
          done={done}
          active={isActive}
          passRatioPercent={passRatioPercent}
          onDone={() => markDone(ex.id)}
          onResetDone={() => markUndone(ex.id)}
        />
      </div>
    );
  };

  return (
    <div className="dialogue-trainer dialogue-trainer--write" data-all-done={allDone ? "true" : "false"}>
      <div className="dialogue-toolbar">
        <div className="dialogue-toolbar-main">
          <div className="dialogue-toolbar-title">
            Роль <b>{role || "—"}</b> · напиши фразу
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
        </div>
        <div className="dialogue-toolbar-actions">
          <label className="dialogue-chip dialogue-pass-chip">
            <span>Порог</span>
            <CustomSelect
              value={String(passRatioPercent)}
              options={passRatioOptions}
              onChange={(next) => {
                const parsed = normalizePassRatioPercent(Number(next));
                setPassRatioPercent(parsed);
                persistPassRatio(storageKey, parsed);
              }}
              triggerClassName="dialogue-pass-select"
              aria-label="Минимальная точность для зачёта"
            />
          </label>
          <button type="button" className="dialogue-btn" onClick={goPrevMyLine} disabled={activeExerciseIndex <= 0}>
            ← моя реплика
          </button>
          <button
            type="button"
            className="dialogue-btn"
            onClick={goNextMyLine}
            disabled={activeExerciseIndex >= exercises.length - 1}
          >
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
                const confirmed = window.confirm("Сбросить прогресс тренажёра для этой роли?");
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
        {allDone ? (
          <div className="dialogue-finished" role="status">
            <div className="dialogue-finished-title">Все реплики пройдены</div>
            <div className="dialogue-finished-meta">
              Вы успешно написали все свои фразы в выбранных сценах. Можно пройти ещё раз или сбросить прогресс.
            </div>
          </div>
        ) : null}
        {allLines.length === 0 ? (
          <div className="dialogue-empty">
            {selectedPlaybookIds.length === 0
              ? "Выберите сцены для тренировки в настройках выше."
              : "Нет текста в выбранных сценах (проверьте поле «Текст» в сценах)."}
          </div>
        ) : (
          allLines.map((line) => (
            <div
              key={line.id}
              ref={(el) => setLineRef(line.id, el)}
              className="dialogue-trainer__line"
              data-scene-id={String(line.sceneId)}
            >
              {renderLine(line)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
