import { useEffect, useMemo, useRef, useState } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { buildDialogueLines, normalizeRoleKey } from "./dialogue";
import {
  findNextUndone,
  persistDoneSet,
  readDoneSet,
} from "./dialogue-scene-progress";
import type { DialogueSceneExercise } from "./dialogue-scene-types";
import { shuffle, stripLeadingPunctuationTokens, tokenizeText } from "./wordTokens";

export type DialogueSceneTrainerProps = {
  scenes: ScriptScene[];
  role: string;
  roleKeys?: string[];
  roleInfo: ProjectRoleInfo | null;
  projectRoles: ProjectRoleInfo[];
  accessToken?: string | null;
  selectedPlaybookIds: number[];
  storageKey?: string;
};

export function useDialogueSceneTrainer({
  scenes,
  role,
  roleKeys,
  roleInfo,
  projectRoles,
  accessToken,
  selectedPlaybookIds,
  storageKey,
}: DialogueSceneTrainerProps) {
  const allLines = useMemo(() => {
    const selected = scenes.filter((s) => selectedPlaybookIds.includes(s.id));
    return buildDialogueLines({ scenes: selected, preferField: "playMarkdown" });
  }, [selectedPlaybookIds, scenes]);

  const desiredRoleKeySet = useMemo(() => {
    const keys = (roleKeys && roleKeys.length ? roleKeys : [role])
      .map((x) => normalizeRoleKey(String(x ?? "")))
      .filter(Boolean);
    return new Set(keys);
  }, [role, roleKeys]);

  const exercises = useMemo(() => {
    const out: DialogueSceneExercise[] = [];
    for (const line of allLines) {
      if (line.kind !== "utterance") continue;
      if (!line.role) continue;
      if (!desiredRoleKeySet.has(normalizeRoleKey(line.role))) continue;
      const tokens = stripLeadingPunctuationTokens(
        tokenizeText(line.text, { includePunctuation: true }),
      );
      if (tokens.length < 1) continue;
      const seed = Number(String(line.sceneId ?? 0)) + line.text.length * 17;
      out.push({
        id: line.id,
        lineId: line.id,
        sceneId: line.sceneId,
        sceneTitle: line.sceneTitle,
        role: line.role,
        text: line.text,
        target: tokens,
        shuffled: shuffle(tokens, seed),
      });
    }
    return out;
  }, [allLines, desiredRoleKeySet]);

  const [doneIds, setDoneIds] = useState<Set<string>>(() => readDoneSet(storageKey));
  const [hideUnspokenText, setHideUnspokenText] = useState(true);
  const [wordPoolHost, setWordPoolHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setDoneIds(readDoneSet(storageKey));
  }, [storageKey]);

  const doneCount = useMemo(() => {
    let c = 0;
    for (const ex of exercises) if (doneIds.has(ex.id)) c += 1;
    return c;
  }, [doneIds, exercises]);

  const total = exercises.length;
  const left = Math.max(0, total - doneCount);
  const allDone = total > 0 && left === 0;

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  useEffect(() => {
    setActiveExerciseIndex((i) => Math.max(0, Math.min(i, Math.max(0, exercises.length - 1))));
  }, [exercises.length]);

  useEffect(() => {
    if (allDone || exercises.length === 0) return;
    const current = exercises[activeExerciseIndex];
    if (current && !doneIds.has(current.id)) return;
    const next = findNextUndone(exercises, doneIds, 0);
    if (next !== activeExerciseIndex) setActiveExerciseIndex(next);
  }, [allDone, activeExerciseIndex, doneIds, exercises]);

  const activeExerciseIndexResolved = useMemo(() => {
    if (allDone) return activeExerciseIndex;
    const current = exercises[activeExerciseIndex];
    if (current && !doneIds.has(current.id)) return activeExerciseIndex;
    return findNextUndone(exercises, doneIds, 0);
  }, [activeExerciseIndex, allDone, doneIds, exercises]);

  const activeExercise = exercises[activeExerciseIndexResolved] ?? null;

  const lineBeforeActive = useMemo(() => {
    if (!activeExercise) return null;

    const activeLineIndex = allLines.findIndex((line) => line.id === activeExercise.lineId);
    if (activeLineIndex < 0) return null;

    return (
      allLines
        .slice(0, activeLineIndex)
        .reverse()
        .find(
          (line) =>
            line.kind === "utterance" && line.sceneId === activeExercise.sceneId,
        ) ?? null
    );
  }, [activeExercise, allLines]);

  const exerciseByLineId = useMemo(() => {
    const map = new Map<string, DialogueSceneExercise>();
    for (const exercise of exercises) {
      map.set(exercise.lineId, exercise);
    }
    return map;
  }, [exercises]);

  const scriptLineRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!activeExercise) return;
    const lineEl = scriptLineRefs.current.get(activeExercise.lineId);
    if (!lineEl) return;
    lineEl.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeExercise?.lineId]);

  const markDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDoneSet(storageKey, next);
      setActiveExerciseIndex((i) => findNextUndone(exercises, next, i + 1));
      return next;
    });
  };

  const markUndone = (id: string) => {
    const next = new Set(doneIds);
    next.delete(id);
    setDoneIds(next);
    persistDoneSet(storageKey, next);
  };

  const goPrevMyLine = () => {
    if (!activeExercise) return;
    setActiveExerciseIndex((i) => Math.max(0, i - 1));
  };

  const goNextMyLine = () => {
    if (!activeExercise) return;
    setActiveExerciseIndex((i) => Math.min(exercises.length - 1, i + 1));
  };

  const goNextUndone = () => {
    setActiveExerciseIndex((i) => findNextUndone(exercises, doneIds, i + 1));
  };

  const jumpToExercise = (lineId: string) => {
    const exerciseIndex = exercises.findIndex((exercise) => exercise.lineId === lineId);
    if (exerciseIndex < 0) return;
    setActiveExerciseIndex(exerciseIndex);
  };

  const resetProgressAll = () => {
    const confirmed = window.confirm("Сбросить прогресс диалогового тренажёра для этой роли?");
    if (!confirmed) return;
    const next = new Set<string>();
    setDoneIds(next);
    persistDoneSet(storageKey, next);
    setActiveExerciseIndex(0);
  };

  const showLearningStage = !allDone && Boolean(activeExercise);
  const showScriptStrip = allLines.length > 0;
  const activeScriptLineIndex = activeExercise
    ? allLines.findIndex((line) => line.id === activeExercise.lineId)
    : -1;

  const emptyMessage =
    allLines.length === 0
      ? selectedPlaybookIds.length === 0
        ? "Выберите сцены в настройках. Если список пуст, выберите роль, у которой есть реплики в тексте."
        : "Нет текста в выбранных сценах (проверьте поле «Текст» в сценах)."
      : null;

  return {
    role,
    roleInfo,
    projectRoles,
    accessToken,
    storageKey,
    allLines,
    exercises,
    doneIds,
    doneCount,
    total,
    left,
    allDone,
    hideUnspokenText,
    setHideUnspokenText,
    wordPoolHost,
    setWordPoolHost,
    activeExerciseIndex,
    activeExerciseIndexResolved,
    activeExercise,
    lineBeforeActive,
    exerciseByLineId,
    scriptLineRefs,
    showLearningStage,
    showScriptStrip,
    activeScriptLineIndex,
    emptyMessage,
    markDone,
    markUndone,
    nav: {
      goPrevMyLine,
      goNextMyLine,
      goNextUndone,
      jumpToExercise,
      resetProgressAll,
    },
  };
}
