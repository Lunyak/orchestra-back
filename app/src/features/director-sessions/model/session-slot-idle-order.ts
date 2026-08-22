/** Порядок слотов с минимальным простоем актёров (пришёл → свои сцены подряд → ушёл). */

export type IdleOrderScore = {
  /** Суммарный простой всех актёров, мин. */
  totalIdleMin: number;
  /** Сколько актёров имеют простой > 0. */
  actorsWithIdle: number;
};

export type IdleOrderSuggestion = {
  order: string[];
  before: IdleOrderScore;
  after: IdleOrderScore;
};

function durationOf(
  slotId: string,
  durationBySlotId: Record<string, number>,
): number {
  return Math.max(1, Math.floor(Number(durationBySlotId[slotId]) || 1));
}

function actorsOf(
  slotId: string,
  actorsBySlotId: Record<string, string[]>,
): string[] {
  return actorsBySlotId[slotId] ?? [];
}

/** Простой при упаковке слотов подряд с offset 0. */
export function computeActorIdleScore(
  order: string[],
  actorsBySlotId: Record<string, string[]>,
  durationBySlotId: Record<string, number>,
): IdleOrderScore {
  if (order.length === 0) {
    return { totalIdleMin: 0, actorsWithIdle: 0 };
  }

  const startBySlot = new Map<string, number>();
  const endBySlot = new Map<string, number>();
  let cursor = 0;
  for (const id of order) {
    const dur = durationOf(id, durationBySlotId);
    startBySlot.set(id, cursor);
    endBySlot.set(id, cursor + dur);
    cursor += dur;
  }

  const slotsByActor = new Map<string, string[]>();
  for (const id of order) {
    for (const email of actorsOf(id, actorsBySlotId)) {
      const list = slotsByActor.get(email);
      if (list) list.push(id);
      else slotsByActor.set(email, [id]);
    }
  }

  let totalIdleMin = 0;
  let actorsWithIdle = 0;
  for (const slotIds of slotsByActor.values()) {
    if (slotIds.length <= 1) continue;
    let firstStart = Infinity;
    let lastEnd = 0;
    let work = 0;
    for (const id of slotIds) {
      firstStart = Math.min(firstStart, startBySlot.get(id) ?? 0);
      lastEnd = Math.max(lastEnd, endBySlot.get(id) ?? 0);
      work += durationOf(id, durationBySlotId);
    }
    const idle = Math.max(0, lastEnd - firstStart - work);
    if (idle > 0) {
      totalIdleMin += idle;
      actorsWithIdle += 1;
    }
  }

  return { totalIdleMin, actorsWithIdle };
}

function scoreBetter(a: IdleOrderScore, b: IdleOrderScore): boolean {
  if (a.totalIdleMin !== b.totalIdleMin) return a.totalIdleMin < b.totalIdleMin;
  return a.actorsWithIdle < b.actorsWithIdle;
}

function intersectionSize(a: string[], b: Set<string>): number {
  let n = 0;
  for (const x of a) {
    if (b.has(x)) n += 1;
  }
  return n;
}

function tailActorSet(
  order: string[],
  actorsBySlotId: Record<string, string[]>,
  tailCount: number,
): Set<string> {
  const set = new Set<string>();
  const from = Math.max(0, order.length - tailCount);
  for (let i = from; i < order.length; i += 1) {
    for (const email of actorsOf(order[i]!, actorsBySlotId)) {
      set.add(email);
    }
  }
  return set;
}

function greedyOrder(
  slotIds: string[],
  actorsBySlotId: Record<string, string[]>,
): string[] {
  if (slotIds.length <= 1) return [...slotIds];

  const remaining = new Set(slotIds);
  let startId = slotIds[0]!;
  let startSize = actorsOf(startId, actorsBySlotId).length;
  for (const id of slotIds) {
    const size = actorsOf(id, actorsBySlotId).length;
    if (size < startSize) {
      startId = id;
      startSize = size;
    }
  }

  const order = [startId];
  remaining.delete(startId);

  while (remaining.size > 0) {
    const tail = tailActorSet(order, actorsBySlotId, 2);
    let bestId: string | null = null;
    let bestOverlap = -1;
    let bestSize = Infinity;
    for (const id of remaining) {
      const actors = actorsOf(id, actorsBySlotId);
      const overlap = intersectionSize(actors, tail);
      const size = actors.length;
      if (
        overlap > bestOverlap ||
        (overlap === bestOverlap && size < bestSize) ||
        (overlap === bestOverlap &&
          size === bestSize &&
          (bestId == null || id < bestId))
      ) {
        bestId = id;
        bestOverlap = overlap;
        bestSize = size;
      }
    }
    if (!bestId) break;
    order.push(bestId);
    remaining.delete(bestId);
  }

  return order;
}

function swapAt(order: string[], i: number, j: number): string[] {
  const next = [...order];
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}

function localImprove(
  order: string[],
  actorsBySlotId: Record<string, string[]>,
  durationBySlotId: Record<string, number>,
): string[] {
  let current = [...order];
  let currentScore = computeActorIdleScore(
    current,
    actorsBySlotId,
    durationBySlotId,
  );
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < current.length - 1; i += 1) {
      const candidate = swapAt(current, i, i + 1);
      const score = computeActorIdleScore(
        candidate,
        actorsBySlotId,
        durationBySlotId,
      );
      if (scoreBetter(score, currentScore)) {
        current = candidate;
        currentScore = score;
        improved = true;
      }
    }
    for (let i = 0; i < current.length; i += 1) {
      for (let j = i + 2; j < current.length; j += 1) {
        const candidate = swapAt(current, i, j);
        const score = computeActorIdleScore(
          candidate,
          actorsBySlotId,
          durationBySlotId,
        );
        if (scoreBetter(score, currentScore)) {
          current = candidate;
          currentScore = score;
          improved = true;
        }
      }
    }
  }
  return current;
}

function factorialPermutations(ids: string[]): string[][] {
  if (ids.length <= 1) return [[...ids]];
  const out: string[][] = [];
  const permute = (arr: string[], start: number) => {
    if (start === arr.length - 1) {
      out.push([...arr]);
      return;
    }
    for (let i = start; i < arr.length; i += 1) {
      const tmp = arr[start]!;
      arr[start] = arr[i]!;
      arr[i] = tmp;
      permute(arr, start + 1);
      arr[i] = arr[start]!;
      arr[start] = tmp;
    }
  };
  permute([...ids], 0);
  return out;
}

function bruteBestOrder(
  slotIds: string[],
  actorsBySlotId: Record<string, string[]>,
  durationBySlotId: Record<string, number>,
): string[] {
  let best = [...slotIds];
  let bestScore = computeActorIdleScore(
    best,
    actorsBySlotId,
    durationBySlotId,
  );
  for (const perm of factorialPermutations(slotIds)) {
    const score = computeActorIdleScore(
      perm,
      actorsBySlotId,
      durationBySlotId,
    );
    if (scoreBetter(score, bestScore)) {
      best = perm;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Предлагает порядок слотов с минимальным суммарным простоем актёров.
 * При ≤8 слотах — полный перебор; иначе greedy + локальные улучшения.
 */
export function suggestIdleMinimizingSlotOrder(
  slotIds: string[],
  actorsBySlotId: Record<string, string[]>,
  durationBySlotId: Record<string, number>,
): IdleOrderSuggestion | null {
  const ids = slotIds.filter((id) => String(id ?? "").trim().length > 0);
  if (ids.length < 2) return null;

  const before = computeActorIdleScore(
    ids,
    actorsBySlotId,
    durationBySlotId,
  );

  const order =
    ids.length <= 8
      ? bruteBestOrder(ids, actorsBySlotId, durationBySlotId)
      : localImprove(
          greedyOrder(ids, actorsBySlotId),
          actorsBySlotId,
          durationBySlotId,
        );

  const after = computeActorIdleScore(
    order,
    actorsBySlotId,
    durationBySlotId,
  );

  return { order, before, after };
}

/** Offset’ы подряд с нуля в заданном порядке (как packSlotsSequentialInOrder). */
export function packedOffsetsForOrder(
  order: string[],
  durationBySlotId: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  let offset = 0;
  for (const id of order) {
    out[id] = offset;
    offset += durationOf(id, durationBySlotId);
  }
  return out;
}
