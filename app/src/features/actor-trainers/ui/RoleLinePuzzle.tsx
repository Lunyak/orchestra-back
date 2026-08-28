import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Buttons } from "../../../shared/components/buttons/Buttons";
import type { DialogueSceneExercise } from "../model/dialogue-scene-types";
import {
  answerTokensForDisplay,
  buildPoolWordLabels,
  isAutoToken,
  joinAnswerTokens,
} from "../model/dialogue-scene-tokens";
import type { WordToken } from "../model/wordTokens";

export type RoleLinePuzzleProps = {
  ex: DialogueSceneExercise;
  done: boolean;
  active: boolean;
  onDone: () => void;
  onResetDone: () => void;
  wordPoolHost: HTMLElement | null;
};

export function RoleLinePuzzle({
  ex,
  done,
  active,
  onDone,
  onResetDone,
  wordPoolHost,
}: RoleLinePuzzleProps) {
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
