import type { TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";

export const DEFAULT_THEATER_LAYOUT: TheaterLayout = {
  hallWidth: 9,
  hallDepth: 6,
  wallHeight: 6,
  audienceStartZ: 3,
  seatRows: 4,
  seatsPerRow: 7,
  seatSpacing: 1.1,
  rowSpacing: 0.8,
  rowRise: 0.25,
  aisleWidth: 1.2,
  aisleCenterX: 0,
  doorWidth: 1.2,
  doorHeight: 2.2,
  doorZ: -6,
};

export const DEFAULT_SPOTLIGHTS: TheaterSpotlight[] = [
  {
    id: 1,
    label: "Софит 1",
    position: [-4, 6, 6],
    target: [-2, 1, 2],
    angleDeg: 18,
    intensity: 1.1,
    color: "#fbbf24",
    enabled: true,
    channel: 1,
  },
  {
    id: 2,
    label: "Софит 2",
    position: [0, 6, 6],
    target: [0, 1, 2],
    angleDeg: 22,
    intensity: 1.2,
    color: "#f59e0b",
    enabled: true,
    channel: 2,
  },
  {
    id: 3,
    label: "Софит 3",
    position: [4, 6, 6],
    target: [2, 1, 2],
    angleDeg: 20,
    intensity: 1.0,
    color: "#f97316",
    enabled: true,
    channel: 3,
  },
];
