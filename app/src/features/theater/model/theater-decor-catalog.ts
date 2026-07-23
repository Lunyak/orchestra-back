import type { TheaterModel } from "../../../shared/types/script";

export type DecorCatalogKey =
  | "curtain"
  | "hangingFabric"
  | "flat"
  | "screen"
  | "platform";

export type DecorCatalogEntry = {
  key: DecorCatalogKey;
  label: string;
  builtin: NonNullable<TheaterModel["builtin"]>;
  parametric: boolean;
  defaultSize: [number, number, number];
  defaultColor: string;
};

export const DECOR_CATALOG: DecorCatalogEntry[] = [
  {
    key: "curtain",
    label: "Занавес",
    builtin: "curtain",
    parametric: true,
    defaultSize: [8, 4, 0.15],
    defaultColor: "#8b1538",
  },
  {
    key: "hangingFabric",
    label: "Висящая ткань",
    builtin: "hangingFabric",
    parametric: true,
    defaultSize: [3, 2.6, 0.28],
    defaultColor: "#6d1328",
  },
  {
    key: "flat",
    label: "Кулиса",
    builtin: "flat",
    parametric: true,
    defaultSize: [2, 3, 0.1],
    defaultColor: "#5c4033",
  },
  {
    key: "screen",
    label: "Параметрическая ширма",
    builtin: "screen",
    parametric: true,
    defaultSize: [1.5, 2, 0.08],
    defaultColor: "#4a4a4a",
  },
  {
    key: "platform",
    label: "Подиум",
    builtin: "platform",
    parametric: true,
    defaultSize: [3, 0.4, 2],
    defaultColor: "#3d2817",
  },
];

const PARAMETRIC_DECOR = new Set<TheaterModel["builtin"]>([
  "flat",
  "curtain",
  "hangingFabric",
  "platform",
  "screen",
]);

const DECOR_BUILTINS = new Set<TheaterModel["builtin"]>(
  DECOR_CATALOG.map((item) => item.builtin),
);

export function isTheaterDecorModel(model: TheaterModel): boolean {
  if (model.type === "file" || model.file) return false;
  return model.builtin != null && DECOR_BUILTINS.has(model.builtin);
}

export function isParametricDecorBuiltin(
  builtin: TheaterModel["builtin"] | undefined,
): boolean {
  return builtin != null && PARAMETRIC_DECOR.has(builtin);
}

export function getDecorCatalogEntry(
  key: DecorCatalogKey,
): DecorCatalogEntry {
  const entry = DECOR_CATALOG.find((item) => item.key === key);
  if (!entry) return DECOR_CATALOG[0];
  return entry;
}

export function getDecorCatalogEntryByBuiltin(
  builtin: TheaterModel["builtin"],
): DecorCatalogEntry | undefined {
  return DECOR_CATALOG.find((item) => item.builtin === builtin);
}

export function resolveDecorSize(
  model: Pick<TheaterModel, "builtin" | "decorSize">,
  fallback?: [number, number, number],
): [number, number, number] {
  if (model.decorSize) return model.decorSize;
  const entry = DECOR_CATALOG.find((item) => item.builtin === model.builtin);
  return entry?.defaultSize ?? fallback ?? [1, 1, 1];
}

export function resolveDecorColor(
  model: Pick<TheaterModel, "builtin" | "decorColor">,
  fallback?: string,
): string | undefined {
  if (model.decorColor) return model.decorColor;
  const entry = DECOR_CATALOG.find((item) => item.builtin === model.builtin);
  return entry?.defaultColor ?? fallback;
}

export function snapTheaterCoord(value: number, step: number, origin = 0): number {
  if (step <= 0) return value;
  return origin + Math.round((value - origin) / step) * step;
}
