import type { TheaterLayout, TheaterModel } from "../../../shared/types/script";
import type { DecorCatalogKey } from "./theater-decor-catalog";
import { getDecorCatalogEntry } from "./theater-decor-catalog";
import { toDecorTexturePresetRef } from "./theater-decor-textures";

export type DecorSceneTemplateId = "basic" | "minimal" | "arena" | "blackbox" | "thrust";

export type DecorSceneTemplate = {
  id: DecorSceneTemplateId;
  label: string;
  description: string;
};

export const DECOR_SCENE_TEMPLATES: DecorSceneTemplate[] = [
  {
    id: "basic",
    label: "Базовая сцена",
    description: "Занавес, кулисы, подиум",
  },
  {
    id: "minimal",
    label: "Минимум",
    description: "Только занавес",
  },
  {
    id: "arena",
    label: "Арена",
    description: "Подиум по центру, кулисы по бокам",
  },
  {
    id: "blackbox",
    label: "Black box",
    description: "Чёрные стены по периметру, без занавеса",
  },
  {
    id: "thrust",
    label: "Выступ",
    description: "Подиум в зал, боковые кулисы",
  },
];

type DecorItemSpec = {
  key: DecorCatalogKey;
  position: [number, number, number];
  size: [number, number, number];
  decorColor?: string;
  decorTexture?: string;
  decorTextureMode?: TheaterModel["decorTextureMode"];
  decorTextureRepeat?: number;
};

function makeDecorItemFromSpec(id: number, spec: DecorItemSpec): TheaterModel {
  const preset = getDecorCatalogEntry(spec.key);
  return {
    id,
    name: preset.label,
    type: "builtin",
    builtin: preset.builtin,
    decorSize: spec.size,
    decorColor: spec.decorColor ?? preset.defaultColor,
    decorTexture: spec.decorTexture,
    decorTextureMode: spec.decorTextureMode,
    decorTextureRepeat: spec.decorTextureRepeat,
    allowOutOfBounds: false,
    position: spec.position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function buildBasicScene(layout: TheaterLayout, startId: number): TheaterModel[] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  let id = startId;
  const curtainW = Math.min(layout.hallWidth * 0.92, layout.hallWidth - 0.4);
  const flatH = Math.min(3.2, layout.wallHeight * 0.55);

  const specs: DecorItemSpec[] = [
    {
      key: "curtain",
      position: [0, 0, -halfD + 0.12],
      size: [curtainW, Math.min(4.5, layout.wallHeight * 0.75), 0.14],
      decorTexture: toDecorTexturePresetRef("velvet-crimson"),
      decorTextureMode: "cover",
    },
    {
      key: "flat",
      position: [-halfW * 0.55, 0, -halfD * 0.42],
      size: [2, flatH, 0.1],
      decorTexture: toDecorTexturePresetRef("canvas-beige"),
      decorTextureMode: "contain",
    },
    {
      key: "flat",
      position: [halfW * 0.55, 0, -halfD * 0.42],
      size: [2, flatH, 0.1],
      decorTexture: toDecorTexturePresetRef("canvas-beige"),
      decorTextureMode: "contain",
    },
    {
      key: "platform",
      position: [0, 0, -halfD * 0.22],
      size: [Math.min(4, layout.hallWidth * 0.45), 0.35, 2.2],
      decorTexture: toDecorTexturePresetRef("wood-oak"),
      decorTextureMode: "repeat",
      decorTextureRepeat: 0.6,
    },
  ];

  return specs.map((spec) => makeDecorItemFromSpec(++id, spec));
}

function buildMinimalScene(layout: TheaterLayout, startId: number): TheaterModel[] {
  const halfD = layout.hallDepth / 2;
  const curtainW = Math.min(layout.hallWidth * 0.88, layout.hallWidth - 0.5);
  return [
    makeDecorItemFromSpec(startId + 1, {
      key: "curtain",
      position: [0, 0, -halfD + 0.1],
      size: [curtainW, Math.min(4, layout.wallHeight * 0.7), 0.12],
      decorTexture: toDecorTexturePresetRef("velvet-navy"),
      decorTextureMode: "cover",
    }),
  ];
}

function buildArenaScene(layout: TheaterLayout, startId: number): TheaterModel[] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  let id = startId;
  const flatH = Math.min(2.8, layout.wallHeight * 0.5);

  const specs: DecorItemSpec[] = [
    {
      key: "platform",
      position: [0, 0, -halfD * 0.08],
      size: [Math.min(5, layout.hallWidth * 0.55), 0.4, 3],
      decorTexture: toDecorTexturePresetRef("wood-oak"),
      decorTextureMode: "repeat",
      decorTextureRepeat: 0.5,
    },
    {
      key: "flat",
      position: [-halfW * 0.72, 0, -halfD * 0.25],
      size: [1.6, flatH, 0.1],
      decorTexture: toDecorTexturePresetRef("concrete-gray"),
      decorTextureMode: "cover",
    },
    {
      key: "flat",
      position: [halfW * 0.72, 0, -halfD * 0.25],
      size: [1.6, flatH, 0.1],
      decorTexture: toDecorTexturePresetRef("concrete-gray"),
      decorTextureMode: "cover",
    },
  ];

  return specs.map((spec) => makeDecorItemFromSpec(++id, spec));
}

function buildBlackboxScene(layout: TheaterLayout, startId: number): TheaterModel[] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  let id = startId;
  const flatH = Math.min(3.5, layout.wallHeight * 0.65);
  const flatD = 0.08;

  const specs: DecorItemSpec[] = [
    {
      key: "flat",
      position: [0, 0, -halfD + flatD],
      size: [layout.hallWidth - 0.3, flatH, flatD],
      decorColor: "#1a1a1a",
    },
    {
      key: "flat",
      position: [-halfW + flatD, 0, 0],
      size: [flatD, flatH, layout.hallDepth - 0.4],
      decorColor: "#1a1a1a",
    },
    {
      key: "flat",
      position: [halfW - flatD, 0, 0],
      size: [flatD, flatH, layout.hallDepth - 0.4],
      decorColor: "#1a1a1a",
    },
    {
      key: "platform",
      position: [0, 0, -halfD * 0.15],
      size: [Math.min(5, layout.hallWidth * 0.5), 0.25, 2.5],
      decorColor: "#2a2a2a",
    },
  ];

  return specs.map((spec) => makeDecorItemFromSpec(++id, spec));
}

function buildThrustScene(layout: TheaterLayout, startId: number): TheaterModel[] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  let id = startId;
  const flatH = Math.min(3, layout.wallHeight * 0.55);

  const specs: DecorItemSpec[] = [
    {
      key: "platform",
      position: [0, 0, halfD * 0.08],
      size: [Math.min(4.5, layout.hallWidth * 0.42), 0.35, layout.hallDepth * 0.55],
      decorTexture: toDecorTexturePresetRef("wood-oak"),
      decorTextureMode: "repeat",
      decorTextureRepeat: 0.55,
    },
    {
      key: "flat",
      position: [-halfW * 0.62, 0, -halfD * 0.35],
      size: [1.8, flatH, 0.1],
      decorTexture: toDecorTexturePresetRef("canvas-beige"),
      decorTextureMode: "contain",
    },
    {
      key: "flat",
      position: [halfW * 0.62, 0, -halfD * 0.35],
      size: [1.8, flatH, 0.1],
      decorTexture: toDecorTexturePresetRef("canvas-beige"),
      decorTextureMode: "contain",
    },
    {
      key: "curtain",
      position: [0, 0, -halfD + 0.1],
      size: [Math.min(layout.hallWidth * 0.7, layout.hallWidth - 1), flatH * 0.9, 0.1],
      decorTexture: toDecorTexturePresetRef("velvet-navy"),
      decorTextureMode: "cover",
    },
  ];

  return specs.map((spec) => makeDecorItemFromSpec(++id, spec));
}

export function buildDecorSceneTemplate(
  templateId: DecorSceneTemplateId,
  layout: TheaterLayout,
  startId: number,
): TheaterModel[] {
  switch (templateId) {
    case "minimal":
      return buildMinimalScene(layout, startId);
    case "arena":
      return buildArenaScene(layout, startId);
    case "blackbox":
      return buildBlackboxScene(layout, startId);
    case "thrust":
      return buildThrustScene(layout, startId);
    case "basic":
    default:
      return buildBasicScene(layout, startId);
  }
}

/** @deprecated используйте buildDecorSceneTemplate("basic", ...) */
export function buildBasicDecorSketch(
  layout: TheaterLayout,
  startId: number,
): TheaterModel[] {
  return buildDecorSceneTemplate("basic", layout, startId);
}
