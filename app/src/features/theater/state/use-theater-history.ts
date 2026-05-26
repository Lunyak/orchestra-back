import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ScriptStep, TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";
import { DEFAULT_SPOTLIGHTS } from "../model/theater-defaults";
import {
  createTheaterHistorySnapshot,
  createTheaterUndoStack,
  type TheaterHistorySnapshot,
} from "../model/theater-history";
import {
  readStepTheaterModels,
  writeStepTheaterModels,
} from "../model/theater-step-models";

export type UseTheaterHistoryArgs = {
  projectName: string;
  currentPage: number;
  currentStep: ScriptStep | undefined;
  layout: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  updateStep: (stepId: number, patch: Partial<ScriptStep>) => void;
};

export type TheaterHistoryController = {
  applyingHistoryRef: MutableRefObject<boolean>;
  historyTransactionRef: MutableRefObject<boolean>;
  captureTheaterHistory: () => TheaterHistorySnapshot | null;
  applyTheaterHistory: (snapshot: TheaterHistorySnapshot) => void;
  recordTheaterHistory: () => void;
  beginTheaterHistoryTransaction: () => void;
  endTheaterHistoryTransaction: () => void;
  undoTheater: () => void;
  redoTheater: () => void;
  canUndoTheater: boolean;
  canRedoTheater: boolean;
};

/**
 * Undo/redo stack for theater step + layout. Refs are shared with drag/transform handlers.
 */
export function useTheaterHistory({
  projectName,
  currentPage,
  currentStep,
  layout,
  onTheaterLayoutChange,
  updateStep,
}: UseTheaterHistoryArgs): TheaterHistoryController {
  const historyStackRef = useRef(createTheaterUndoStack());
  const historyTransactionRef = useRef(false);
  const applyingHistoryRef = useRef(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const bumpHistory = useCallback(() => setHistoryRevision((v) => v + 1), []);

  const captureTheaterHistory = useCallback((): TheaterHistorySnapshot | null => {
    if (!currentStep) return null;
    const spotlightsForHistory: TheaterSpotlight[] | undefined =
      currentStep.theaterSpotlights === undefined
        ? DEFAULT_SPOTLIGHTS
        : currentStep.theaterSpotlights;
    return createTheaterHistorySnapshot({
      step: currentStep,
      layout,
      spotlights: spotlightsForHistory,
      models: readStepTheaterModels(currentStep),
    });
  }, [currentStep, layout]);

  const applyTheaterHistory = useCallback(
    (snapshot: TheaterHistorySnapshot) => {
      applyingHistoryRef.current = true;
      try {
        onTheaterLayoutChange?.(snapshot.layout);
        updateStep(snapshot.stepId, {
          theaterSpotlights: snapshot.theaterSpotlights,
          ...writeStepTheaterModels(snapshot.theaterModels),
          theaterActiveSpotlightId: snapshot.theaterActiveSpotlightId,
          theaterActiveModelId: snapshot.theaterActiveModelId,
        });
      } finally {
        applyingHistoryRef.current = false;
      }
    },
    [onTheaterLayoutChange, updateStep],
  );

  const recordTheaterHistory = useCallback(() => {
    if (applyingHistoryRef.current || historyTransactionRef.current) return;
    const snapshot = captureTheaterHistory();
    if (!snapshot) return;
    historyStackRef.current.push(snapshot);
    bumpHistory();
  }, [bumpHistory, captureTheaterHistory]);

  const beginTheaterHistoryTransaction = useCallback(() => {
    if (historyTransactionRef.current) return;
    recordTheaterHistory();
    historyTransactionRef.current = true;
  }, [recordTheaterHistory]);

  const endTheaterHistoryTransaction = useCallback(() => {
    historyTransactionRef.current = false;
  }, []);

  const undoTheater = useCallback(() => {
    const current = captureTheaterHistory();
    if (!current) return;
    const prev = historyStackRef.current.undo(current);
    if (!prev) return;
    applyTheaterHistory(prev);
    bumpHistory();
  }, [applyTheaterHistory, bumpHistory, captureTheaterHistory]);

  const redoTheater = useCallback(() => {
    const current = captureTheaterHistory();
    if (!current) return;
    const next = historyStackRef.current.redo(current);
    if (!next) return;
    applyTheaterHistory(next);
    bumpHistory();
  }, [applyTheaterHistory, bumpHistory, captureTheaterHistory]);

  const canUndoTheater =
    historyRevision >= 0 && historyStackRef.current.canUndo();
  const canRedoTheater =
    historyRevision >= 0 && historyStackRef.current.canRedo();

  useEffect(() => {
    historyStackRef.current.clear();
    bumpHistory();
  }, [bumpHistory, currentPage, projectName]);

  return {
    applyingHistoryRef,
    historyTransactionRef,
    captureTheaterHistory,
    applyTheaterHistory,
    recordTheaterHistory,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    undoTheater,
    redoTheater,
    canUndoTheater,
    canRedoTheater,
  };
}
