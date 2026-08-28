import { useEffect, useState } from "react";
import {
  findNextUndoneIndex,
  persistDoneSet,
  readDoneSet,
} from "./voice-trainer-progress";
import type { VoiceExercise } from "./voice-trainer-types";
import { countDoneExercises } from "./voice-dialogue-helpers";

export function useVoiceDialogueProgress(opts: {
  storageKey?: string;
  exercises: VoiceExercise[];
}) {
  const { storageKey, exercises } = opts;

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
  const [allDoneDialog, setAllDoneDialog] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const restored = readDoneSet(storageKey);
    setDoneIds(restored);
    if (restored.size > 0 && exercises.length > 0) {
      setIndex((i) => {
        const next = findNextUndoneIndex(exercises, restored, i);
        if (next == null) {
          setAllDoneDialog(true);
          return i;
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  const doneCount = countDoneExercises(exercises, doneIds);
  const total = exercises.length;
  const left = Math.max(0, total - doneCount);
  const allDone = total > 0 && left === 0;

  const markDone = (exerciseId: string) => {
    const next = new Set(doneIds);
    next.add(exerciseId);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    return next;
  };

  const clearDone = (exerciseId: string) => {
    const next = new Set(doneIds);
    next.delete(exerciseId);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    return next;
  };

  const clearAllDone = () => {
    const next = new Set<string>();
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    return next;
  };

  return {
    doneIds,
    setDoneIds,
    allDoneDialog,
    setAllDoneDialog,
    index,
    setIndex,
    doneCount,
    total,
    left,
    allDone,
    markDone,
    clearDone,
    clearAllDone,
  };
}
