import { useCallback } from "react";
import type { ScriptScene, TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import {
  copyFloorPlanToClipboard,
  downloadFloorPlanPdf,
  downloadFloorPlanPng,
  downloadFloorPlanSvg,
} from "../model/theater-floor-plan-export";

export type UseTheaterFloorPlanArgs = {
  projectName: string;
  currentScene: ScriptScene | undefined;
  layout: TheaterLayout;
  visibleModels: TheaterModel[];
  visibleSpotlights: TheaterSpotlight[];
  showSeats: boolean;
  showSpotlights: boolean;
  showGrid: boolean;
  gridStep: number;
  setDecorActionMessage: (message: string | null) => void;
};

export function useTheaterFloorPlan({
  projectName,
  currentScene,
  layout,
  visibleModels,
  visibleSpotlights,
  showSeats,
  showSpotlights,
  showGrid,
  gridStep,
  setDecorActionMessage,
}: UseTheaterFloorPlanArgs) {
  const exportFloorPlanSvg = useCallback(() => {
    downloadFloorPlanSvg({
      layout,
      models: visibleModels,
      spotlights: visibleSpotlights,
      showSeats,
      showSpotlights,
      showGrid,
      gridStep,
      title: currentScene?.title ?? projectName,
    });
    setDecorActionMessage("План зала сохранён (SVG)");
  }, [
    currentScene?.title,
    gridStep,
    layout,
    projectName,
    setDecorActionMessage,
    showGrid,
    showSeats,
    showSpotlights,
    visibleModels,
    visibleSpotlights,
  ]);

  const exportFloorPlanPng = useCallback(async () => {
    await downloadFloorPlanPng({
      layout,
      models: visibleModels,
      spotlights: visibleSpotlights,
      showSeats,
      showSpotlights,
      showGrid,
      gridStep,
      width: 840,
      height: 680,
      title: currentScene?.title ?? projectName,
    });
    setDecorActionMessage("План зала сохранён (PNG)");
  }, [
    currentScene?.title,
    gridStep,
    layout,
    projectName,
    setDecorActionMessage,
    showGrid,
    showSeats,
    showSpotlights,
    visibleModels,
    visibleSpotlights,
  ]);

  const exportFloorPlanPdf = useCallback(() => {
    downloadFloorPlanPdf({
      layout,
      models: visibleModels,
      spotlights: visibleSpotlights,
      showSeats,
      showSpotlights,
      showGrid,
      gridStep,
      title: currentScene?.title ?? projectName,
    });
    setDecorActionMessage("Открыт диалог печати (PDF)");
  }, [
    currentScene?.title,
    gridStep,
    layout,
    projectName,
    setDecorActionMessage,
    showGrid,
    showSeats,
    showSpotlights,
    visibleModels,
    visibleSpotlights,
  ]);

  const copyFloorPlanToClipboardFn = useCallback(async () => {
    const ok = await copyFloorPlanToClipboard({
      layout,
      models: visibleModels,
      spotlights: visibleSpotlights,
      showSeats,
      showSpotlights,
      showGrid,
      gridStep,
      width: 840,
      height: 680,
      title: currentScene?.title ?? projectName,
    });
    setDecorActionMessage(
      ok ? "План скопирован в буфер" : "Буфер обмена недоступен",
    );
  }, [
    currentScene?.title,
    gridStep,
    layout,
    projectName,
    setDecorActionMessage,
    showGrid,
    showSeats,
    showSpotlights,
    visibleModels,
    visibleSpotlights,
  ]);

  return {
    exportFloorPlanSvg,
    exportFloorPlanPng,
    exportFloorPlanPdf,
    copyFloorPlanToClipboard: copyFloorPlanToClipboardFn,
  };
}
