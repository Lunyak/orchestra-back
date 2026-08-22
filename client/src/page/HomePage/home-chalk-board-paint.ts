import type { TicBoard } from "./tic-tac-toe";
import {
  drawChalkGrid,
  drawChalkO,
  drawChalkX,
  drawNeonLogoTriangle,
  easeOutCubic,
} from "./chalk-canvas-draw";

export const LOGICAL_BOARD_SIZE = 300;
export const CELL_SIZE = LOGICAL_BOARD_SIZE / 3;

const GRID_SEED = 17;

export function cellCenter(index: number) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    cx: col * CELL_SIZE + CELL_SIZE / 2,
    cy: row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function markSeed(index: number, mark: "X" | "O") {
  return index * 97 + (mark === "X" ? 31 : 47);
}

export function syncBoardCanvasSize(canvas: HTMLCanvasElement, wrap: HTMLElement): number {
  const rect = wrap.getBoundingClientRect();
  const size = Math.max(1, Math.round(Math.min(rect.width, rect.height)));
  const dpr = window.devicePixelRatio || 1;
  const buffer = Math.round(size * dpr);

  if (canvas.width !== buffer || canvas.height !== buffer) {
    canvas.width = buffer;
    canvas.height = buffer;
  }

  return size;
}

type PaintOptions = {
  board: TicBoard;
  animatingIndex: number | null;
  animProgress: number;
  gridProgress?: number;
  winMorphIndex?: number | null;
  winMorphProgress?: number;
};

function drawCellMark(
  ctx: CanvasRenderingContext2D,
  index: number,
  mark: "X" | "O",
  isAnimating: boolean,
  animProgress: number,
  layerPasses: number,
  winMorphIndex: number | null,
  winMorphProgress: number
) {
  const { cx, cy } = cellCenter(index);
  const seed = markSeed(index, mark);
  const progress = isAnimating ? animProgress : 1;
  const isMorphCell = winMorphIndex !== null && index === winMorphIndex;
  const morphT = isMorphCell ? easeOutCubic(winMorphProgress) : 0;
  const chalkFade = 1 - morphT;

  if (chalkFade > 0.02) {
    ctx.save();
    ctx.globalAlpha = chalkFade;
    if (mark === "X") {
      drawChalkX(ctx, cx, cy, CELL_SIZE * 0.3, seed, progress, layerPasses);
    } else {
      drawChalkO(ctx, cx, cy, CELL_SIZE * 0.27, seed, progress, layerPasses);
    }
    ctx.restore();
  }

  if (morphT > 0) {
    drawNeonLogoTriangle(ctx, cx, cy, CELL_SIZE * 0.58, morphT, seed);
  }
}

export function paintChalkBoard(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  options: PaintOptions
) {
  const {
    board,
    animatingIndex,
    animProgress,
    gridProgress = 1,
    winMorphIndex = null,
    winMorphProgress = 0,
  } = options;

  const size = syncBoardCanvasSize(canvas, wrap);
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const scale = size / LOGICAL_BOARD_SIZE;
  ctx.save();
  ctx.scale(scale, scale);

  drawChalkGrid(ctx, LOGICAL_BOARD_SIZE, LOGICAL_BOARD_SIZE, GRID_SEED, gridProgress);

  for (let index = 0; index < board.length; index += 1) {
    const mark = board[index];
    if (!mark) continue;

    const isAnimating = index === animatingIndex;
    const layerPasses = isAnimating ? 1 : 4;

    drawCellMark(
      ctx,
      index,
      mark,
      isAnimating,
      animProgress,
      layerPasses,
      winMorphIndex,
      winMorphProgress
    );
  }

  ctx.restore();
}
