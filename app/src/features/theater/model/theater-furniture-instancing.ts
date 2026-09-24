import type { TheaterModel } from "../../../shared/types/script";
import { isParametricDecorBuiltin } from "./theater-decor-catalog";
import {
  BENCH_METRICS,
  CHAIR_METRICS,
  getFurnitureBounds,
  getFurnitureBoundsYOffset,
  SOFA_METRICS,
} from "./theater-furniture-metrics";

export const INSTANCED_FURNITURE_BUILTINS = new Set<
  NonNullable<TheaterModel["builtin"]>
>(["blackCube", "chair", "bench", "sofa", "cabinet"]);

export const INSTANCED_LIBRARY_BUILTINS = new Set<
  NonNullable<TheaterModel["builtin"]>
>(["libraryWoodenCrate", "libraryPortCrate"]);

export type FurniturePartSpec = {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  colorToken: `--${string}`;
};

function chairParts(): FurniturePartSpec[] {
  const seatCenterY = CHAIR_METRICS.seatHeight - CHAIR_METRICS.seatThickness / 2;
  const legHeight = CHAIR_METRICS.seatHeight - CHAIR_METRICS.seatThickness;
  const legY = legHeight / 2;
  const legX = CHAIR_METRICS.width / 2 - CHAIR_METRICS.legInset;
  const legZ = CHAIR_METRICS.depth / 2 - CHAIR_METRICS.legInset;
  const legs: [number, number][] = [
    [-legX, -legZ],
    [legX, -legZ],
    [-legX, legZ],
    [legX, legZ],
  ];
  return [
    {
      id: "seat",
      size: [CHAIR_METRICS.width, CHAIR_METRICS.seatThickness, CHAIR_METRICS.depth],
      position: [0, seatCenterY, 0],
      colorToken: "--color-slate-600",
    },
    {
      id: "back",
      size: [CHAIR_METRICS.width, CHAIR_METRICS.backHeight, CHAIR_METRICS.backThickness],
      position: [0, CHAIR_METRICS.seatHeight + CHAIR_METRICS.backHeight / 2, CHAIR_METRICS.backZ],
      colorToken: "--color-border-default",
    },
    ...legs.map(([x, z], index) => ({
      id: `leg-${index}`,
      size: [CHAIR_METRICS.legThickness, legHeight, CHAIR_METRICS.legThickness] as [
        number,
        number,
        number,
      ],
      position: [x, legY, z] as [number, number, number],
      colorToken: "--color-surface-1" as const,
    })),
  ];
}

function benchParts(): FurniturePartSpec[] {
  const seatCenterY = BENCH_METRICS.seatHeight - BENCH_METRICS.seatThickness / 2;
  const legHeight = BENCH_METRICS.seatHeight - BENCH_METRICS.seatThickness;
  const legX = BENCH_METRICS.width / 2 - BENCH_METRICS.legInset;
  const legSize: [number, number, number] = [
    BENCH_METRICS.legThickness,
    legHeight,
    BENCH_METRICS.depth * 0.8,
  ];
  return [
    {
      id: "seat",
      size: [BENCH_METRICS.width, BENCH_METRICS.seatThickness, BENCH_METRICS.depth],
      position: [0, seatCenterY, 0],
      colorToken: "--color-3d-wood-tan",
    },
    {
      id: "leg-left",
      size: legSize,
      position: [-legX, legHeight / 2, 0],
      colorToken: "--color-3d-wood-dark",
    },
    {
      id: "leg-right",
      size: legSize,
      position: [legX, legHeight / 2, 0],
      colorToken: "--color-3d-wood-dark",
    },
  ];
}

function sofaParts(): FurniturePartSpec[] {
  return [
    {
      id: "seat",
      size: [SOFA_METRICS.width, SOFA_METRICS.seatThickness, SOFA_METRICS.depth * 0.72],
      position: [0, SOFA_METRICS.seatHeight, 0.05],
      colorToken: "--color-slate-600",
    },
    {
      id: "back",
      size: [SOFA_METRICS.width, SOFA_METRICS.backHeight, SOFA_METRICS.backThickness],
      position: [
        0,
        SOFA_METRICS.seatHeight + SOFA_METRICS.backHeight / 2,
        SOFA_METRICS.backZ,
      ],
      colorToken: "--color-border-default",
    },
    {
      id: "arm-left",
      size: [SOFA_METRICS.armWidth, SOFA_METRICS.armHeight, SOFA_METRICS.depth * 0.78],
      position: [-SOFA_METRICS.width / 2 + SOFA_METRICS.armWidth / 2, SOFA_METRICS.armHeight / 2, 0.03],
      colorToken: "--color-slate-700",
    },
    {
      id: "arm-right",
      size: [SOFA_METRICS.armWidth, SOFA_METRICS.armHeight, SOFA_METRICS.depth * 0.78],
      position: [SOFA_METRICS.width / 2 - SOFA_METRICS.armWidth / 2, SOFA_METRICS.armHeight / 2, 0.03],
      colorToken: "--color-slate-700",
    },
  ];
}

export function getFurnitureParts(
  builtin: NonNullable<TheaterModel["builtin"]>,
): FurniturePartSpec[] | null {
  switch (builtin) {
    case "chair":
      return chairParts();
    case "bench":
      return benchParts();
    case "sofa":
      return sofaParts();
    case "blackCube":
      return [
        {
          id: "body",
          size: [1, 1, 1],
          position: [0, 0.5, 0],
          colorToken: "--color-3d-black",
        },
      ];
    case "cabinet":
      return [
        {
          id: "body",
          size: [0.9, 1, 0.4],
          position: [0, 0.5, 0],
          colorToken: "--color-3d-wood-accent",
        },
        {
          id: "door",
          size: [0.85, 0.95, 0.02],
          position: [0, 0.5, 0.21],
          colorToken: "--color-3d-wood-brown",
        },
        {
          id: "handle",
          size: [0.05, 0.05, 0.03],
          position: [0.25, 0.55, 0.23],
          colorToken: "--color-3d-wood-gold",
        },
      ];
    default:
      return null;
  }
}

export type FurnitureInstanceGroup = {
  key: string;
  builtin: NonNullable<TheaterModel["builtin"]>;
  color: string;
  lowDetail: boolean;
  models: TheaterModel[];
};

export function canInstanceTheaterModel(model: TheaterModel): boolean {
  if (model.type === "file" || model.file) return false;
  if (model.isRequisite === true) return false;
  if (!model.builtin) return false;
  if (model.decorTexture || isParametricDecorBuiltin(model.builtin)) return false;
  if (INSTANCED_FURNITURE_BUILTINS.has(model.builtin)) return true;
  return INSTANCED_LIBRARY_BUILTINS.has(model.builtin);
}

export function splitModelsForFurnitureInstancing(
  models: TheaterModel[],
  excludeIds: ReadonlySet<number>,
): {
  instanced: TheaterModel[];
  individual: TheaterModel[];
} {
  const instanced: TheaterModel[] = [];
  const individual: TheaterModel[] = [];

  for (const model of models) {
    if (excludeIds.has(model.id) || !canInstanceTheaterModel(model)) {
      individual.push(model);
      continue;
    }
    instanced.push(model);
  }

  return { instanced, individual };
}

export function groupFurnitureInstances(
  models: TheaterModel[],
): FurnitureInstanceGroup[] {
  const map = new Map<string, FurnitureInstanceGroup>();

  for (const model of models) {
    if (!model.builtin) continue;
    const color = model.decorColor ?? "default";
    const detail = model.modelLowDetail ? "low" : "full";
    const key = `${model.builtin}|${color}|${detail}`;
    const existing = map.get(key);
    if (existing) {
      existing.models.push(model);
      continue;
    }
    map.set(key, {
      key,
      builtin: model.builtin,
      color,
      lowDetail: detail === "low",
      models: [model],
    });
  }

  return Array.from(map.values());
}

export function getFurnitureInstanceGeometry(
  builtin: NonNullable<TheaterModel["builtin"]>,
): [number, number, number] {
  return getFurnitureBounds(builtin);
}

export function getFurnitureInstanceYOffset(
  builtin: NonNullable<TheaterModel["builtin"]>,
): number {
  return getFurnitureBoundsYOffset(builtin);
}
