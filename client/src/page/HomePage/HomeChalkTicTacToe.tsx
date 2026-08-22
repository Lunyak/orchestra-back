import { FC, useEffect, useRef, useState } from "react";
import { cn } from "../../shared/lib/cn";
import { paintChalkBoard } from "./home-chalk-board-paint";
import {
  EMPTY_BOARD,
  findWinLine,
  getWinner,
  pickComputerMove,
  type TicBoard,
  type TicMark,
} from "./tic-tac-toe";

type GamePhase = "idle" | "player" | "thinking" | "ended";

const USER_MARK: TicMark = "X";
const AI_MARK: TicMark = "O";
const MARK_ANIM_MS = 1050;
const GRID_ANIM_MS = 800;
const WIN_MORPH_MS = 900;
const WIN_MORPH_DELAY_MS = 450;

function statusText(winner: ReturnType<typeof getWinner>, phase: GamePhase): string {
  if (phase === "thinking") return "Думаю…";
  if (winner === "X") return "Вы выиграли";
  if (winner === "O") return "";
  if (winner === "draw") return "Ничья";
  if (phase === "player") return "Ваш ход — X";
  return "Крестики-нолики";
}

function findNewMarkIndex(prev: TicBoard, next: TicBoard): number | null {
  for (let index = 0; index < next.length; index += 1) {
    if (prev[index] === null && next[index] !== null) return index;
  }
  return null;
}

export const HomeChalkTicTacToe: FC = () => {
  const [board, setBoard] = useState<TicBoard>(EMPTY_BOARD);
  const [phase, setPhase] = useState<GamePhase>("player");
  const [winMorphIndex, setWinMorphIndex] = useState<number | null>(null);

  const boardRef = useRef<TicBoard>(EMPTY_BOARD);
  const prevBoardRef = useRef<TicBoard>(EMPTY_BOARD);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);
  const morphTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const gridIntroDoneRef = useRef(false);
  const winMorphIndexRef = useRef<number | null>(null);
  const winMorphRef = useRef(0);

  boardRef.current = board;

  const winner = getWinner(board);
  const gameOver = winner !== null;

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const paintBoard = (
    snapshot: TicBoard,
    animatingIndex: number | null = null,
    animProgress = 1,
    gridProgress = 1
  ) => {
    const canvas = canvasRef.current;
    const wrap = boardWrapRef.current;
    if (!canvas || !wrap) return;

    paintChalkBoard(canvas, wrap, {
      board: snapshot,
      animatingIndex,
      animProgress,
      gridProgress,
      winMorphIndex: winMorphIndexRef.current,
      winMorphProgress: winMorphRef.current,
    });
  };

  const paintStatic = (snapshot: TicBoard, gridProgress = 1) => {
    paintBoard(snapshot, null, 1, gridProgress);
  };

  const scheduleWinMorph = () => {
    if (morphTimerRef.current !== null) return;
    if (winMorphIndexRef.current === null || getWinner(boardRef.current) === "draw") return;

    morphTimerRef.current = window.setTimeout(() => {
      morphTimerRef.current = null;
      runWinMorph();
    }, WIN_MORPH_DELAY_MS);
  };

  const runWinMorph = () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      winMorphRef.current = 1;
      paintStatic(boardRef.current, 1);
      return;
    }

    stopAnimation();
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / WIN_MORPH_MS);
      winMorphRef.current = t;
      paintStatic(boardRef.current, 1);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const afterWinPaint = (snapshot: TicBoard) => {
    if (winMorphIndexRef.current !== null && getWinner(snapshot) !== "draw") {
      scheduleWinMorph();
    }
  };

  const runMarkAnimation = (
    snapshot: TicBoard,
    animatingIndex: number,
    onDone?: () => void
  ) => {
    stopAnimation();
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / MARK_ANIM_MS);
      paintBoard(snapshot, animatingIndex, t, 1);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        paintStatic(snapshot, 1);
        onDone?.();
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const runIntroAnimation = (
    snapshot: TicBoard,
    newMarkIndex: number | null,
    onDone?: () => void
  ) => {
    stopAnimation();
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const gridT = Math.min(1, elapsed / GRID_ANIM_MS);
      const markT = newMarkIndex === null ? 1 : Math.min(1, elapsed / MARK_ANIM_MS);

      paintBoard(snapshot, newMarkIndex, markT, gridT);

      const gridDone = gridT >= 1;
      const markDone = newMarkIndex === null || markT >= 1;

      if (!gridDone || !markDone) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      rafRef.current = null;
      paintStatic(snapshot, 1);
      onDone?.();
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const scheduleBoardPaint = (snapshot: TicBoard, prev: TicBoard) => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const newMarkIndex = findNewMarkIndex(prev, snapshot);

    if (!gridIntroDoneRef.current) {
      if (prefersReducedMotion) {
        paintStatic(snapshot, 1);
        gridIntroDoneRef.current = true;
        afterWinPaint(snapshot);
        return;
      }

      runIntroAnimation(snapshot, newMarkIndex, () => {
        gridIntroDoneRef.current = true;
        afterWinPaint(snapshot);
      });
      return;
    }

    if (newMarkIndex !== null && !prefersReducedMotion) {
      runMarkAnimation(snapshot, newMarkIndex, () => afterWinPaint(snapshot));
      return;
    }

    paintStatic(snapshot, 1);
    afterWinPaint(snapshot);
  };

  const syncWinState = (snapshot: TicBoard, lastMarkIndex: number | null) => {
    const line = findWinLine(snapshot);

    if (!line) {
      winMorphIndexRef.current = null;
      winMorphRef.current = 0;
      setWinMorphIndex(null);
      return;
    }

    winMorphIndexRef.current = lastMarkIndex;
    setWinMorphIndex(lastMarkIndex);
    setPhase("ended");
  };

  useEffect(() => {
    return () => {
      stopAnimation();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (morphTimerRef.current !== null) window.clearTimeout(morphTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const prev = prevBoardRef.current;
    const lastMarkIndex = findNewMarkIndex(prev, board);
    syncWinState(board, lastMarkIndex);
    scheduleBoardPaint(board, prev);
    prevBoardRef.current = board;
  }, [board]);

  useEffect(() => {
    const wrap = boardWrapRef.current;
    if (!wrap) return;

    const observer = new ResizeObserver(() => {
      paintStatic(boardRef.current, 1);
    });

    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const resetGame = () => {
    stopAnimation();
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (morphTimerRef.current !== null) window.clearTimeout(morphTimerRef.current);
    morphTimerRef.current = null;
    prevBoardRef.current = EMPTY_BOARD;
    gridIntroDoneRef.current = true;
    winMorphRef.current = 0;
    winMorphIndexRef.current = null;
    setBoard(EMPTY_BOARD);
    setWinMorphIndex(null);
    setPhase("player");
  };

  const playComputer = (nextBoard: TicBoard) => {
    setPhase("thinking");

    timerRef.current = window.setTimeout(() => {
      const move = pickComputerMove(nextBoard, AI_MARK);
      if (move < 0) return;

      setBoard((prev) => {
        const updated = [...prev];
        updated[move] = AI_MARK;
        return updated;
      });
      setPhase("player");
    }, 650);
  };

  const handleCellClick = (index: number) => {
    if (phase !== "player" || board[index] !== null || gameOver) return;

    const nextBoard = [...board];
    nextBoard[index] = USER_MARK;
    setBoard(nextBoard);

    const nextWinner = getWinner(nextBoard);
    if (nextWinner !== null) return;

    playComputer(nextBoard);
  };

  const status = statusText(winner, phase);
  const canPlay = phase === "player" && !gameOver;

  return (
    <section className="home-chalk-game" aria-label="Крестики-нолики">
      {status && (
        <p className="home-chalk-game__status" role="status">
          {status}
        </p>
      )}

      <div
        ref={boardWrapRef}
        className={cn("home-chalk-game__board", gameOver && "home-chalk-game__board--ended")}
      >
        <canvas className="home-chalk-game__surface" ref={canvasRef} aria-hidden />
        <div className="home-chalk-game__hits">
          {board.map((cell, index) => {
            const isWinCell = winMorphIndex === index;
            const cellLabel = cell === "X" ? "Крестик" : cell === "O" ? "Нолик" : "Пусто";

            return (
              <button
                key={index}
                type="button"
                className={cn(
                  "home-chalk-game__cell",
                  isWinCell && "home-chalk-game__cell--win"
                )}
                onClick={() => handleCellClick(index)}
                disabled={!canPlay || cell !== null}
                aria-label={`Клетка ${index + 1}: ${cellLabel}`}
              />
            );
          })}
        </div>
      </div>

      {gameOver && (
        <button type="button" className="home-chalk-game__reset" onClick={resetGame}>
          Сыграть ещё
        </button>
      )}
    </section>
  );
};
