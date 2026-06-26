import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ScriptScene, TheaterSpotlight } from "../../../shared/types/script";
import {
  normalizeLightCues,
  resolveSpotlightsAtLightCueTime,
  stepDurationSec,
} from "../model/theater-light-cues";

export type UseTheaterRehearsalArgs = {
  currentPage: number;
  currentScene: ScriptScene | undefined;
  displaySpotlights: TheaterSpotlight[];
  setRehearsalSpotlights: Dispatch<SetStateAction<TheaterSpotlight[] | null>>;
  setSpectaclePreviewMode: (value: boolean) => void;
};

export function useTheaterRehearsal({
  currentPage,
  currentScene,
  displaySpotlights,
  setRehearsalSpotlights,
  setSpectaclePreviewMode,
}: UseTheaterRehearsalArgs) {
  const [sceneRehearsalMode, setSceneRehearsalMode] = useState(false);

  useEffect(() => {
    setSceneRehearsalMode(false);
  }, [currentPage]);

  useEffect(() => {
    if (!sceneRehearsalMode || !currentScene) {
      setRehearsalSpotlights(null);
      return undefined;
    }
    setSpectaclePreviewMode(true);
    const cues = normalizeLightCues(currentScene.lightCues ?? []);
    if (cues.length === 0) {
      setRehearsalSpotlights(null);
      return undefined;
    }
    const duration = Math.max(1, stepDurationSec(currentScene.durationMin));
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
    currentScene,
    currentScene?.durationMin,
    currentScene?.id,
    currentScene?.lightCues,
    displaySpotlights,
    setSpectaclePreviewMode,
    sceneRehearsalMode,
  ]);

  return {
    sceneRehearsalMode,
    setSceneRehearsalMode,
  };
}
