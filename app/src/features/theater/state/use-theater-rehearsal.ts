import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ScriptStep, TheaterSpotlight } from "../../../shared/types/script";
import {
  normalizeLightCues,
  resolveSpotlightsAtLightCueTime,
  stepDurationSec,
} from "../model/theater-light-cues";

export type UseTheaterRehearsalArgs = {
  currentPage: number;
  currentStep: ScriptStep | undefined;
  displaySpotlights: TheaterSpotlight[];
  setRehearsalSpotlights: Dispatch<SetStateAction<TheaterSpotlight[] | null>>;
  setSpectaclePreviewMode: (value: boolean) => void;
};

export function useTheaterRehearsal({
  currentPage,
  currentStep,
  displaySpotlights,
  setRehearsalSpotlights,
  setSpectaclePreviewMode,
}: UseTheaterRehearsalArgs) {
  const [stepRehearsalMode, setStepRehearsalMode] = useState(false);

  useEffect(() => {
    setStepRehearsalMode(false);
  }, [currentPage]);

  useEffect(() => {
    if (!stepRehearsalMode || !currentStep) {
      setRehearsalSpotlights(null);
      return undefined;
    }
    setSpectaclePreviewMode(true);
    const cues = normalizeLightCues(currentStep.lightCues ?? []);
    if (cues.length === 0) {
      setRehearsalSpotlights(null);
      return undefined;
    }
    const duration = Math.max(1, stepDurationSec(currentStep.durationMin));
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = ((performance.now() - started) / 1000) % duration;
      setRehearsalSpotlights(
        resolveSpotlightsAtLightCueTime(displaySpotlights, cues, elapsed),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setRehearsalSpotlights(null);
    };
  }, [
    currentStep,
    currentStep?.durationMin,
    currentStep?.id,
    currentStep?.lightCues,
    displaySpotlights,
    setSpectaclePreviewMode,
    stepRehearsalMode,
  ]);

  return {
    stepRehearsalMode,
    setStepRehearsalMode,
  };
}
