import type { TheaterSceneViewModel } from "./use-theater-scene";

export function theaterMobileSaveKey(projectName: string) {
  return `orchestra-theater-mobile-save:${projectName || "default"}`;
}

export function slugifyTheaterFilename(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "theater";
}

export function buildTheaterMobileSnapshot(vm: TheaterSceneViewModel) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    projectName: vm.projectName,
    scene: vm.currentScene
      ? {
          id: vm.currentScene.id,
          title: vm.currentScene.title,
          page: vm.currentPage,
        }
      : null,
    layout: vm.layout,
    spotlights: vm.displaySpotlights,
    models: vm.models,
    active: {
      tab: vm.activeTab,
      modelId: vm.activeModelId ?? null,
      spotlightId: vm.activeSpotlightId ?? null,
    },
    view: {
      showGrid: vm.showGrid,
      showStageGrid: vm.showStageGrid,
      showSeats: vm.showSeats,
      showFloorPlan: vm.showFloorPlan,
      floorPlanMaxSide: vm.floorPlanMaxSide,
      wallsHidden: vm.wallsHidden,
      wallsOpaque: vm.wallsOpaque,
      spectaclePreviewMode: vm.spectaclePreviewMode,
    },
  };
}

export function serializeTheaterMobileSnapshot(vm: TheaterSceneViewModel) {
  return JSON.stringify(buildTheaterMobileSnapshot(vm), null, 2);
}

export function downloadTheaterMobileSnapshot(vm: TheaterSceneViewModel) {
  const text = serializeTheaterMobileSnapshot(vm);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const title = vm.currentScene?.title?.trim() || vm.projectName;
  anchor.href = url;
  anchor.download = `${slugifyTheaterFilename(title)}-theater.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
