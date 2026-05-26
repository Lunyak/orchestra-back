import { tc } from "../../../shared/styles/theme-color";
import type { TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";
import { METRIC, normalizeTheaterLayout } from "./theater-metrics";
import { THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY } from "./theater-scene-lighting";

const RAW_DEFAULT_LAYOUT: TheaterLayout = {
  hallWidth: 12,
  hallDepth: 10,
  wallHeight: METRIC.wallHeight,
  stageFrontZ: -1.5,
  audienceStartZ: -3,
  seatRows: 5,
  seatsPerRow: 10,
  seatSpacing: METRIC.seatPitch,
  rowSpacing: METRIC.rowPitch,
  rowRise: METRIC.rowRise,
  aisleWidth: METRIC.aisleWidth,
  aisleCenterX: 0,
  doorWidth: 1.2,
  doorHeight: 2.2,
  doorZ: 0,
};

export const DEFAULT_THEATER_LAYOUT: TheaterLayout =
  normalizeTheaterLayout(RAW_DEFAULT_LAYOUT);

export const DEFAULT_SPOTLIGHTS: TheaterSpotlight[] = [
  {
    id: 1,
    label: "Софит 1",
    position: [-4, 6, 4],
    target: [-2, 1, 1],
    angleDeg: 18,
    intensity: THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
    color: tc("--color-warning"),
    enabled: true,
    channel: 1,
  },
  {
    id: 2,
    label: "Софит 2",
    position: [0, 6, 4],
    target: [0, 1, 1],
    angleDeg: 22,
    intensity: THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
    color: tc("--color-light-yellow"),
    enabled: true,
    channel: 2,
  },
  {
    id: 3,
    label: "Софит 3",
    position: [4, 6, 4],
    target: [2, 1, 1],
    angleDeg: 20,
    intensity: THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
    color: tc("--color-light-orange"),
    enabled: true,
    channel: 3,
  },
];
