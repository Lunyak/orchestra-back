export type TicMark = "X" | "O";
export type TicCell = TicMark | null;
export type TicBoard = TicCell[];

export const EMPTY_BOARD: TicBoard = [null, null, null, null, null, null, null, null, null];

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function findWinLine(board: TicBoard): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return [a, b, c];
    }
  }
  return null;
}

export function getWinner(board: TicBoard): TicMark | "draw" | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return mark;
  }

  const hasEmpty = board.some((cell) => cell === null);
  return hasEmpty ? null : "draw";
}

function scoreBoard(board: TicBoard, ai: TicMark): number {
  const winner = getWinner(board);
  if (winner === ai) return 10;
  if (winner === "draw") return 0;
  if (winner === null) return 0;
  return -10;
}

function minimax(board: TicBoard, ai: TicMark, turn: TicMark, depth: number): number {
  const winner = getWinner(board);
  if (winner !== null) return scoreBoard(board, ai) - depth;

  const player = turn;
  let best = player === ai ? -Infinity : Infinity;

  for (let i = 0; i < board.length; i += 1) {
    if (board[i] !== null) continue;
    const next = [...board];
    next[i] = player;
    const nextTurn = player === "X" ? "O" : "X";
    const value = minimax(next, ai, nextTurn, depth + 1);
    if (player === ai) best = Math.max(best, value);
    else best = Math.min(best, value);
  }

  return best;
}

export function pickComputerMove(board: TicBoard, ai: TicMark = "O"): number {
  const winner = getWinner(board);
  if (winner !== null) return -1;

  const emptyIndexes = board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index >= 0);

  if (emptyIndexes.length === 0) return -1;

  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const index of emptyIndexes) {
    const next = [...board];
    next[index] = ai;
    const value = minimax(next, ai, "X", 0);
    if (value > bestScore) {
      bestScore = value;
      bestMoves = [index];
    } else if (value === bestScore) {
      bestMoves.push(index);
    }
  }

  const pick = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return pick;
}
