import type { TheaterSceneSlices } from "../types/theater-view-model-slices";
import type { UseTheaterViewPrefsResult } from "./use-theater-view-prefs";
import type { TheaterHistoryController } from "./use-theater-history";

/** Builds nested VM slices from composed hook outputs (flat API remains primary). */
export function buildTheaterViewModelSlices(input: {
  prefs: UseTheaterViewPrefsResult;
  history: Pick<
    TheaterHistoryController,
    | "undoTheater"
    | "redoTheater"
    | "canUndoTheater"
    | "canRedoTheater"
    | "beginTheaterHistoryTransaction"
    | "endTheaterHistoryTransaction"
  >;
  document: TheaterSceneSlices["document"];
  selection: TheaterSceneSlices["selection"];
  spotlights: TheaterSceneSlices["spotlights"];
  models: TheaterSceneSlices["models"];
  decor: TheaterSceneSlices["decor"];
}): TheaterSceneSlices {
  return {
    prefs: input.prefs,
    history: input.history,
    document: input.document,
    selection: input.selection,
    spotlights: input.spotlights,
    models: input.models,
    decor: input.decor,
  };
}
