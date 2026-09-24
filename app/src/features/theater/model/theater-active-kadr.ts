import { useSyncExternalStore } from "react";
import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { cloneTheaterModels, cloneTheaterSpotlights } from "./theater-history";

/**
 * Куда пишутся правки 3D-сета (модели, декор, софиты).
 *
 * Отдельного режима «сцена / кадр» нет. Правки всегда идут в кадр.
 * Сцена без картин сама и есть этот кадр: `kind: "scene"`, черновика нет,
 * `updateModels` / `updateSpotlights` пишут поля сцены.
 *
 * Как только на ленте выбрана картина, она становится целью записи.
 * Её сет живёт в `draft` и в `lightKadrs[].theaterSnapshot`.
 * Поля `theaterModels` / `theaterSpotlights` сцены при этом не меняются.
 *
 * Новая картина копирует текущий сет: сцену, если картин ещё не было,
 * или черновик открытой картины (`createKadrFromDraft`).
 */

export type KadrTheaterBaseline = {
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
};

export type TheaterKadrDraft = {
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
};

export type TheaterSaveTarget =
  | { kind: "scene" }
  | { kind: "kadr"; id: string; title: string };

let saveTarget: TheaterSaveTarget = { kind: "scene" };
let draft: TheaterKadrDraft | null = null;
let baseline: KadrTheaterBaseline | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTheaterActiveKadrId(): string | null {
  return saveTarget.kind === "kadr" ? saveTarget.id : null;
}

export function getTheaterKadrDraft(): TheaterKadrDraft | null {
  return saveTarget.kind === "kadr" ? draft : null;
}

export function useTheaterKadrDraftModels(): TheaterModel[] | null {
  return useSyncExternalStore(
    subscribe,
    () => (saveTarget.kind === "kadr" ? draft?.models ?? null : null),
    () => null,
  );
}

export function useTheaterKadrDraftSpotlights(): TheaterSpotlight[] | null {
  return useSyncExternalStore(
    subscribe,
    () => (saveTarget.kind === "kadr" ? draft?.spotlights ?? null : null),
    () => null,
  );
}

export function enterTheaterKadrEdit(args: {
  id: string;
  title: string;
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
}): void {
  const sameKadr =
    saveTarget.kind === "kadr" && saveTarget.id === args.id && draft != null;
  if (sameKadr && saveTarget.kind === "kadr" && saveTarget.title === args.title) return;
  saveTarget = { kind: "kadr", id: args.id, title: args.title };
  if (!sameKadr) {
    draft = {
      models: cloneTheaterModels(args.models),
      spotlights: cloneTheaterSpotlights(args.spotlights),
    };
    baseline = null;
  }
  emit();
}

export function exitTheaterKadrEdit(): void {
  if (saveTarget.kind === "scene" && draft == null) return;
  saveTarget = { kind: "scene" };
  draft = null;
  baseline = null;
  emit();
}

export function replaceTheaterKadrDraft(next: TheaterKadrDraft): void {
  if (saveTarget.kind !== "kadr") return;
  draft = {
    models: cloneTheaterModels(next.models),
    spotlights: cloneTheaterSpotlights(next.spotlights),
  };
  emit();
}

export function rememberKadrTheaterBaseline(
  models: TheaterModel[],
  spotlights: TheaterSpotlight[],
  replace = false,
): void {
  if (baseline && !replace) return;
  baseline = {
    models: cloneTheaterModels(models),
    spotlights: cloneTheaterSpotlights(spotlights),
  };
}

export function takeKadrTheaterBaseline(): KadrTheaterBaseline | null {
  const value = baseline;
  baseline = null;
  return value;
}
