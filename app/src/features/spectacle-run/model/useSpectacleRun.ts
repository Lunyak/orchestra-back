import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScene } from "../../scene";
import type { SceneLightChannelRolesV1 } from "../../scene/model/scene-slice";
import {
  applyKadrToFaders,
  findKadrById,
  readStepLightKadrs,
} from "../../theater/model/light-kadrs";
import { recordLightKadrForSection } from "../../../shared/components/light-console/light-kadr-record";
import { resolveLightFaders, resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { ScriptStep } from "../../../shared/types/script";
import {
  appendKadrToStep,
  buildSpectacleKadrTape,
  findTapeIndexForStepKadr,
  isLastTapeItemInStep,
  nextKadrNumberForStep,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";

const TEXT_HIDDEN_KEY = "orchestra-spectacle-run-text-hidden";

function readTextHiddenPreference(): boolean {
  try {
    return localStorage.getItem(TEXT_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeTextHiddenPreference(hidden: boolean) {
  try {
    localStorage.setItem(TEXT_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // ignore
  }
}

export type UseSpectacleRunArgs = {
  projectName: string;
  steps: ScriptStep[];
  lightChannels: string[];
};

export function useSpectacleRun({ projectName, steps, lightChannels }: UseSpectacleRunArgs) {
  const { sceneData, setSceneData, updateStep, setCurrentPage, currentPage } = useScene();
  const tape = useMemo(() => buildSpectacleKadrTape(steps), [steps]);
  const [tapeIndex, setTapeIndex] = useState(0);
  const [textHidden, setTextHidden] = useState(readTextHiddenPreference);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const applyingTapeRef = useRef(false);
  const liveSaveTimerRef = useRef<number | null>(null);
  const tapeIndexRef = useRef(0);
  const tapeInitRef = useRef(false);
  const pendingTapeKadrIdRef = useRef<string | null>(null);

  const lightFaders = useMemo(
    () => resolveLightFaders(sceneData?.lightFaders ?? undefined),
    [sceneData?.lightFaders],
  );
  const lightPrograms = useMemo(
    () => resolveLightPrograms(sceneData?.lightPrograms),
    [sceneData?.lightPrograms],
  );

  const clampedIndex = tape.length === 0 ? 0 : Math.min(tapeIndex, tape.length - 1);
  const currentItem = tape[clampedIndex] ?? null;
  const currentStep = currentItem ? steps[currentItem.stepIndex] : null;

  tapeIndexRef.current = clampedIndex;

  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: currentStep?.theaterSpotlights ?? [],
  });

  const flushLiveSave = useCallback(() => {
    const index = tapeIndexRef.current;
    const item = tape[index];
    const step = item ? steps[item.stepIndex] : null;
    if (!item || !step || !item.section || item.isPlaceholder) return;

    const result = recordLightKadrForSection({
      markdown: String(step.markdown ?? ""),
      section: item.section,
      existingKadrId: item.kadrId,
      kadrs: readStepLightKadrs(step),
      lightChannels,
      lightFaders: liveConsole.faders,
      lightPrograms: liveConsole.programs,
      programId: liveConsole.programs.activeProgramId ?? 1,
    });
    if (!result) return;

    updateStep(step.id, {
      lightKadrs: result.nextKadrs,
      markdown: result.nextMarkdown,
    } as Partial<ScriptStep>);
    setLiveStatus(`Записано: ${item.headingTitle}`);
  }, [lightChannels, liveConsole.faders, liveConsole.programs, steps, tape, updateStep]);

  const scheduleLiveSave = useCallback(() => {
    if (applyingTapeRef.current) return;
    const item = tape[tapeIndexRef.current];
    if (!item?.section || item.isPlaceholder) return;
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
    }
    liveSaveTimerRef.current = window.setTimeout(() => {
      liveSaveTimerRef.current = null;
      flushLiveSave();
    }, 550);
  }, [flushLiveSave, tape]);

  const applyTapeItem = useCallback(
    (item: SpectacleTapeItem) => {
      applyingTapeRef.current = true;
      setCurrentPage(item.stepIndex);

      const step = steps[item.stepIndex];
      if (!step || item.isPlaceholder) {
        applyingTapeRef.current = false;
        return;
      }

      const kadrs = readStepLightKadrs(step);
      const kadr =
        (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
        kadrs.kadrs.find((k) => k.kadrNo === item.kadrNo);

      if (!kadr) {
        applyingTapeRef.current = false;
        return;
      }

      const nextFaders = applyKadrToFaders(kadr, liveConsole.faders);
      liveConsole.persistFaders(nextFaders);

      if (kadr.programId > 0) {
        liveConsole.persistPrograms({
          ...liveConsole.programs,
          activeProgramId: kadr.programId,
        });
      }

      window.setTimeout(() => {
        applyingTapeRef.current = false;
      }, 0);
    },
    [liveConsole, setCurrentPage, steps],
  );

  useEffect(() => {
    if (tape.length === 0 || tapeInitRef.current) return;
    tapeInitRef.current = true;
    const onStep = tape.findIndex((item) => item.stepIndex === currentPage);
    if (onStep >= 0) setTapeIndex(onStep);
  }, [currentPage, tape]);

  useEffect(() => {
    const item = tape[clampedIndex];
    if (!item) return;
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
    }
    applyTapeItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только смена позиции в ленте
  }, [clampedIndex]);

  const consoleSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        faders: liveConsole.faders.faders.map((f) => ({
          id: f.id,
          intensity: f.intensity,
          enabled: f.enabled,
          color: f.color,
        })),
        programId: liveConsole.programs.activeProgramId,
      }),
    [liveConsole.faders.faders, liveConsole.programs.activeProgramId],
  );

  useEffect(() => {
    if (applyingTapeRef.current) return;
    scheduleLiveSave();
    return () => {
      if (liveSaveTimerRef.current != null) {
        window.clearTimeout(liveSaveTimerRef.current);
      }
    };
  }, [consoleSnapshotKey, scheduleLiveSave]);

  useEffect(() => {
    if (tape.length === 0) return;
    if (tapeIndex > tape.length - 1) {
      setTapeIndex(Math.max(0, tape.length - 1));
    }
  }, [tape.length, tapeIndex]);

  useEffect(() => {
    const pendingId = pendingTapeKadrIdRef.current;
    if (!pendingId || tape.length === 0) return;
    pendingTapeKadrIdRef.current = null;
    const idx = findTapeIndexForStepKadr(tape, -1, pendingId);
    if (idx >= 0) setTapeIndex(idx);
  }, [tape, steps]);

  const addKadrToCurrentStep = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const { nextMarkdown, nextKadrs, kadrId, kadrNo } = appendKadrToStep({ step });
    pendingTapeKadrIdRef.current = kadrId;
    updateStep(step.id, {
      markdown: nextMarkdown,
      lightKadrs: nextKadrs,
    } as Partial<ScriptStep>);
    setLiveStatus(`Добавлена картина ${kadrNo} в «${item.stepTitle}»`);
  }, [clampedIndex, steps, tape, updateStep]);

  const goToTapeIndex = useCallback(
    (nextIndex: number) => {
      if (tape.length === 0) return;
      const clamped = Math.max(0, Math.min(tape.length - 1, nextIndex));
      if (liveSaveTimerRef.current != null) {
        window.clearTimeout(liveSaveTimerRef.current);
        liveSaveTimerRef.current = null;
        flushLiveSave();
      }
      setTapeIndex(clamped);
    },
    [flushLiveSave, tape.length],
  );

  const goPrev = useCallback(() => goToTapeIndex(clampedIndex - 1), [clampedIndex, goToTapeIndex]);
  const goNext = useCallback(() => goToTapeIndex(clampedIndex + 1), [clampedIndex, goToTapeIndex]);

  const goNextStep = useCallback(() => {
    if (!currentItem) return;
    const nextInTape = tape.findIndex(
      (item, index) => index > clampedIndex && item.stepIndex > currentItem.stepIndex,
    );
    if (nextInTape >= 0) goToTapeIndex(nextInTape);
  }, [clampedIndex, currentItem, goToTapeIndex, tape]);

  const toggleTextHidden = useCallback(() => {
    setTextHidden((prev) => {
      const next = !prev;
      writeTextHiddenPreference(next);
      return next;
    });
  }, []);

  const isLastInSpectacle = clampedIndex >= tape.length - 1;
  const isLastInStep = isLastTapeItemInStep(tape, clampedIndex);
  const canGoNext = !isLastInSpectacle;
  const nextLabel = isLastInStep ? "Следующий шаг" : "Далее";

  return {
    tape,
    tapeIndex: clampedIndex,
    currentItem,
    currentStep,
    textHidden,
    toggleTextHidden,
    liveStatus,
    liveConsole,
    lightFaders,
    lightPrograms,
    lightChannelRoles:
      sceneData?.lightChannelRoles && sceneData.lightChannelRoles.v === 1
        ? sceneData.lightChannelRoles
        : null,
    setLightChannelRoles: (next: SceneLightChannelRolesV1) => {
      setSceneData((prev) => ({ ...(prev ?? {}), lightChannelRoles: next }));
    },
    goPrev,
    goNext,
    goNextStep,
    goToTapeIndex,
    canGoPrev: clampedIndex > 0,
    canGoNext,
    isLastInStep,
    isLastInSpectacle,
    nextLabel,
    flushLiveSave,
    addKadrToCurrentStep,
    nextKadrNo: currentStep ? nextKadrNumberForStep(currentStep) : 1,
    canAddKadr: Boolean(currentStep),
  };
}
