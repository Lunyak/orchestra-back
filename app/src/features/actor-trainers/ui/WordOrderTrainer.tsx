import React, { useMemo, useState } from "react";
import type { RolePhraseSource } from "../model/rolePhrases";
import { isSameTokenSequence, shuffle, tokenizeWords, type WordToken } from "../model/wordTokens";
import "./style.css";

type Exercise = {
  id: string;
  phrase: RolePhraseSource;
  target: WordToken[];
  shuffled: WordToken[];
};

type DragPayload =
  | { from: "pool"; tokenId: string }
  | { from: "answer"; tokenId: string };

function encodeDragPayload(p: DragPayload): string {
  return JSON.stringify(p);
}

function decodeDragPayload(raw: string | null): DragPayload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v?.from === "pool" && typeof v?.tokenId === "string") return v;
    if (v?.from === "answer" && typeof v?.tokenId === "string") return v;
    return null;
  } catch {
    return null;
  }
}

export function WordOrderTrainer({
  phrases,
  title = "Собери реплику из слов",
  storageKey,
}: {
  phrases: RolePhraseSource[];
  title?: string;
  storageKey?: string;
}) {
  const exercises = useMemo(() => {
    const out: Exercise[] = [];
    for (const p of phrases ?? []) {
      const tokens = tokenizeWords(p.text);
      if (tokens.length < 2) continue;
      const seed = Number(String(p.stepId ?? 0)) + p.text.length * 17;
      out.push({
        // Use stable line id so progress survives minor text edits.
        id: p.lineId || `${p.stepId}:${p.role}:${p.text}`,
        phrase: p,
        target: tokens,
        shuffled: shuffle(tokens, seed),
      });
    }
    return out;
  }, [phrases]);

  const [index, setIndex] = useState(0);
  const current = exercises[Math.max(0, Math.min(index, exercises.length - 1))] ?? null;

  const [pool, setPool] = useState<WordToken[]>(() => current?.shuffled ?? []);
  const [answer, setAnswer] = useState<WordToken[]>([]);
  const [checked, setChecked] = useState<null | { ok: boolean }>(null);
  const [showHint, setShowHint] = useState(false);

  const readDoneSet = (): Set<string> => {
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
  };

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet());

  const persistDoneIds = (next: Set<string>) => {
    setDoneIds(next);
    if (!storageKey) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next.values())));
    } catch {
      // ignore
    }
  };

  // Reset when exercise changes
  React.useEffect(() => {
    setPool(current?.shuffled ?? []);
    setAnswer([]);
    setChecked(null);
    setShowHint(false);
  }, [current?.id]);

  // Refresh done set when scope changes (project/actor/role)
  React.useEffect(() => {
    setDoneIds(readDoneSet());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Clamp index when exercises shrink/expand
  React.useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  const total = exercises.length;
  let doneCount = 0;
  if (doneIds.size > 0 && exercises.length > 0) {
    for (const ex of exercises) {
      if (doneIds.has(ex.id)) doneCount += 1;
    }
  }
  const leftCount = Math.max(0, total - doneCount);

  if (!current) {
    return (
      <div className="actor-trainer">
        <div className="actor-trainer-head">
          <h2 className="actor-trainer-title">{title}</h2>
        </div>
        <div className="actor-trainer-empty">Нет реплик для тренировки.</div>
      </div>
    );
  }

  const canCheck = answer.length === current.target.length && answer.length > 0;
  const ok = checked?.ok ?? null;

  const goNextUnfinished = () => {
    if (exercises.length === 0) return;
    const start = Math.max(0, Math.min(index, exercises.length - 1));
    for (let offset = 1; offset <= exercises.length; offset += 1) {
      const i = (start + offset) % exercises.length;
      const ex = exercises[i];
      if (!doneIds.has(ex.id)) {
        setIndex(i);
        return;
      }
    }
    // all done — move next
    setIndex((i) => Math.min(exercises.length - 1, i + 1));
  };

  const moveTokenToAnswer = (tokenId: string, beforeId?: string) => {
    const fromPool = pool.find((t) => t.id === tokenId) ?? null;
    const fromAnswer = answer.find((t) => t.id === tokenId) ?? null;
    const token = fromPool ?? fromAnswer;
    if (!token) return;

    const nextPool = fromPool ? pool.filter((t) => t.id !== tokenId) : pool;
    let nextAnswer = fromAnswer ? answer.filter((t) => t.id !== tokenId) : answer;

    if (beforeId) {
      const idx = nextAnswer.findIndex((t) => t.id === beforeId);
      if (idx >= 0) nextAnswer = [...nextAnswer.slice(0, idx), token, ...nextAnswer.slice(idx)];
      else nextAnswer = [...nextAnswer, token];
    } else {
      nextAnswer = [...nextAnswer, token];
    }

    setPool(nextPool);
    setAnswer(nextAnswer);
    setChecked(null);
  };

  const moveTokenToPool = (tokenId: string, beforeId?: string) => {
    const fromAnswer = answer.find((t) => t.id === tokenId) ?? null;
    const fromPool = pool.find((t) => t.id === tokenId) ?? null;
    const token = fromAnswer ?? fromPool;
    if (!token) return;

    const nextAnswer = fromAnswer ? answer.filter((t) => t.id !== tokenId) : answer;
    let nextPool = fromPool ? pool.filter((t) => t.id !== tokenId) : pool;

    if (beforeId) {
      const idx = nextPool.findIndex((t) => t.id === beforeId);
      if (idx >= 0) nextPool = [...nextPool.slice(0, idx), token, ...nextPool.slice(idx)];
      else nextPool = [...nextPool, token];
    } else {
      nextPool = [...nextPool, token];
    }

    setPool(nextPool);
    setAnswer(nextAnswer);
    setChecked(null);
  };

  return (
    <div className="actor-trainer">
      <div className="actor-trainer-head">
        <h2 className="actor-trainer-title">{title}</h2>
        <div className="actor-trainer-meta">
          <span className="actor-trainer-chip">
            Шаг: <b>{current.phrase.stepTitle}</b>
          </span>
          <span className="actor-trainer-chip">
            Реплика: <b>{index + 1}</b> / {exercises.length}
          </span>
          <span className="actor-trainer-chip">
            Прогресс: <b>{doneCount}</b> / {total} (осталось {leftCount})
          </span>
        </div>
      </div>

      <div className="actor-trainer-panel">
        <div className="actor-trainer-row">
          <div className="actor-trainer-label">Собери:</div>
          <div
            className="actor-trainer-answer"
            data-ok={ok === true ? "true" : ok === false ? "false" : "none"}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const payload = decodeDragPayload(e.dataTransfer.getData("text/plain"));
              if (!payload) return;
              moveTokenToAnswer(payload.tokenId);
            }}
          >
            {answer.length === 0 ? (
              <span className="actor-trainer-muted">нажимай на слова снизу…</span>
            ) : (
              answer.map((t) => (
                <button
                  key={`a-${t.id}`}
                  type="button"
                  className="actor-trainer-token actor-trainer-token--answer"
                  draggable
                  onClick={() => {
                    setAnswer((prev) => prev.filter((x) => x.id !== t.id));
                    setPool((prev) => [...prev, t]);
                    setChecked(null);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "text/plain",
                      encodeDragPayload({ from: "answer", tokenId: t.id }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const payload = decodeDragPayload(e.dataTransfer.getData("text/plain"));
                    if (!payload) return;
                    moveTokenToAnswer(payload.tokenId, t.id);
                  }}
                  title="Убрать слово"
                >
                  {t.text}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="actor-trainer-row">
          <div className="actor-trainer-label">Слова:</div>
          <div
            className="actor-trainer-pool"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const payload = decodeDragPayload(e.dataTransfer.getData("text/plain"));
              if (!payload) return;
              moveTokenToPool(payload.tokenId);
            }}
          >
            {pool.map((t) => (
              <button
                key={`p-${t.id}`}
                type="button"
                className="actor-trainer-token"
                draggable
                onClick={() => {
                  setPool((prev) => prev.filter((x) => x.id !== t.id));
                  setAnswer((prev) => [...prev, t]);
                  setChecked(null);
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "text/plain",
                    encodeDragPayload({ from: "pool", tokenId: t.id }),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const payload = decodeDragPayload(e.dataTransfer.getData("text/plain"));
                  if (!payload) return;
                  moveTokenToPool(payload.tokenId, t.id);
                }}
              >
                {t.text}
              </button>
            ))}
          </div>
        </div>

        <div className="actor-trainer-actions">
          <button
            type="button"
            className="actor-trainer-btn"
            onClick={() => {
              setPool(current.shuffled);
              setAnswer([]);
              setChecked(null);
              setShowHint(false);
            }}
          >
            Сброс
          </button>

          <button
            type="button"
            className="actor-trainer-btn actor-trainer-btn--primary"
            disabled={!canCheck}
            onClick={() => {
              const ok = isSameTokenSequence(answer, current.target);
              setChecked({ ok });
              if (!ok) setShowHint(true);
              if (ok) {
                const next = new Set(doneIds);
                next.add(current.id);
                persistDoneIds(next);
              }
            }}
          >
            Проверить
          </button>

          <button
            type="button"
            className="actor-trainer-btn"
            onClick={() => setShowHint((v) => !v)}
          >
            {showHint ? "Скрыть подсказку" : "Подсказка"}
          </button>

          <button
            type="button"
            className="actor-trainer-btn"
            onClick={goNextUnfinished}
            disabled={exercises.length === 0}
            title="Перейти к следующей непройденной реплике"
          >
            Следующая непройденная
          </button>

          {storageKey ? (
            <button
              type="button"
              className="actor-trainer-btn"
              onClick={() => {
                const confirmed = window.confirm("Сбросить прогресс тренажёра для этой роли?");
                if (!confirmed) return;
                persistDoneIds(new Set());
              }}
            >
              Сбросить прогресс
            </button>
          ) : null}

          <div className="actor-trainer-spacer" />

          <button
            type="button"
            className="actor-trainer-btn"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ←
          </button>
          <button
            type="button"
            className="actor-trainer-btn"
            disabled={index >= exercises.length - 1}
            onClick={() => setIndex((i) => Math.min(exercises.length - 1, i + 1))}
          >
            →
          </button>
        </div>

        {checked ? (
          <div className="actor-trainer-result" data-ok={checked.ok ? "true" : "false"}>
            {checked.ok ? "Верно." : "Пока не так."}
          </div>
        ) : null}

        {showHint ? (
          <div className="actor-trainer-hint">
            <div className="actor-trainer-hint-label">Оригинал:</div>
            <div className="actor-trainer-hint-text">{current.target.map((t) => t.text).join(" ")}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

