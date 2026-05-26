import type { TheaterSpotlight } from "../../../shared/types/script";

export type SpotlightPresetId = "wash" | "spot" | "silhouette";

export type SpotlightPreset = {
  id: SpotlightPresetId;
  label: string;
  description: string;
  patch: Pick<TheaterSpotlight, "angleDeg" | "intensity">;
};

export const SPOTLIGHT_PRESETS: SpotlightPreset[] = [
  {
    id: "wash",
    label: "Заливка",
    description: "Широкий угол, мягкая яркость",
    patch: { angleDeg: 36, intensity: 1.6 },
  },
  {
    id: "spot",
    label: "Пятно",
    description: "Узкий луч, ярче",
    patch: { angleDeg: 12, intensity: 3 },
  },
  {
    id: "silhouette",
    label: "Контур",
    description: "Средний угол для контражура",
    patch: { angleDeg: 22, intensity: 2.2 },
  },
];

export function applySpotlightPresetPatch(
  spotlights: TheaterSpotlight[],
  presetId: SpotlightPresetId,
  scope: "active" | "all",
  activeSpotlightId?: number,
): TheaterSpotlight[] {
  const preset = SPOTLIGHT_PRESETS.find((item) => item.id === presetId);
  if (!preset) return spotlights;
  const targetIds =
    scope === "active" && activeSpotlightId != null
      ? new Set([activeSpotlightId])
      : new Set(spotlights.map((item) => item.id));
  return spotlights.map((item) =>
    targetIds.has(item.id) ? { ...item, ...preset.patch } : item,
  );
}
