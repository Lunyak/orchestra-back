import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  buildProjectAssetUrl,
  isLikelyProjectImagePath,
} from "./theater-decor-asset-url";

export type DecorTexturePresetId =
  | "velvet-crimson"
  | "velvet-navy"
  | "velvet-gold"
  | "canvas-beige"
  | "wood-oak"
  | "concrete-gray";

export type DecorTextureMode = "repeat" | "cover" | "contain" | "once";

export const DECOR_TEXTURE_MODES: {
  id: DecorTextureMode;
  label: string;
  title: string;
}[] = [
  {
    id: "once",
    label: "Целиком",
    title: "Одно изображение на поверхности, без растягивания и без повторов",
  },
  { id: "repeat", label: "Плитка", title: "Повтор узора по поверхности" },
  { id: "cover", label: "Заполнить", title: "Заполнить поверхность, обрезая края" },
  { id: "contain", label: "Вместить", title: "Вписать текстуру целиком (как «Целиком», масштаб 1)" },
];

function clampTextureScale(value: number | undefined, fallback = 1): number {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(2, Math.max(0.05, next));
}

/** Вписать изображение целиком с сохранением пропорций (letterbox при необходимости). */
export function resolveAspectFitTextureMapping(
  meshAspect: number,
  texAspect: number,
  scale = 1,
): DecorTextureMapping {
  const fitScale = clampTextureScale(scale, 1);
  const safeMeshAspect = Math.max(meshAspect, 1e-6);
  const safeTexAspect = Math.max(texAspect, 1e-6);

  let visibleU: number;
  let visibleV: number;

  if (safeMeshAspect >= safeTexAspect) {
    visibleU = Math.min(1, (safeTexAspect / safeMeshAspect) * fitScale);
    visibleV = Math.min(1, fitScale);
  } else {
    visibleU = Math.min(1, fitScale);
    visibleV = Math.min(1, (safeMeshAspect / safeTexAspect) * fitScale);
  }

  visibleU = Math.max(visibleU, 1e-6);
  visibleV = Math.max(visibleV, 1e-6);

  return {
    repeatU: 1 / visibleU,
    repeatV: 1 / visibleV,
    offsetU: -(1 - visibleU) / (2 * visibleU),
    offsetV: -(1 - visibleV) / (2 * visibleV),
    clamp: true,
  };
}

export type DecorTextureMapping = {
  repeatU: number;
  repeatV: number;
  offsetU: number;
  offsetV: number;
  clamp: boolean;
};

export type DecorTexturePreset = {
  id: DecorTexturePresetId;
  label: string;
  /** Базовый цвет подложки под узор */
  tint: string;
};

export const DECOR_TEXTURE_PRESETS: DecorTexturePreset[] = [
  { id: "velvet-crimson", label: "Бархат", tint: "#8b1538" },
  { id: "velvet-navy", label: "Бархат синий", tint: "#1e3a5f" },
  { id: "velvet-gold", label: "Бархат золото", tint: "#9a7b2e" },
  { id: "canvas-beige", label: "Холст", tint: "#c4b59a" },
  { id: "wood-oak", label: "Дерево", tint: "#8b6914" },
  { id: "concrete-gray", label: "Бетон", tint: "#7a7a7a" },
];

export const DECOR_TEXTURE_PRESET_PREFIX = "preset:" as const;
export const DECOR_TEXTURE_FILE_PREFIX = "file:" as const;

export function isDecorTexturePreset(
  value: string | undefined,
): value is `${typeof DECOR_TEXTURE_PRESET_PREFIX}${DecorTexturePresetId}` {
  return Boolean(value?.startsWith(DECOR_TEXTURE_PRESET_PREFIX));
}

export function getDecorTexturePresetId(
  value: string | undefined,
): DecorTexturePresetId | null {
  if (!isDecorTexturePreset(value)) return null;
  return value.slice(DECOR_TEXTURE_PRESET_PREFIX.length) as DecorTexturePresetId;
}

export function toDecorTexturePresetRef(id: DecorTexturePresetId): string {
  return `${DECOR_TEXTURE_PRESET_PREFIX}${id}`;
}

export function toDecorTextureFileRef(relativePath: string): string {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  return `${DECOR_TEXTURE_FILE_PREFIX}${trimmed}`;
}

export function getDecorTextureFilePath(value: string | undefined): string | null {
  if (!value?.startsWith(DECOR_TEXTURE_FILE_PREFIX)) return null;
  return value.slice(DECOR_TEXTURE_FILE_PREFIX.length);
}

export function resolveDecorTextureSrc(
  projectName: string,
  textureRef: string | undefined,
): string | null {
  if (!textureRef) return null;
  if (isDecorTexturePreset(textureRef)) return null;
  if (/^data:image\//i.test(textureRef)) return textureRef;
  if (/^https?:\/\//i.test(textureRef)) return textureRef;
  let relative =
    getDecorTextureFilePath(textureRef) ??
    textureRef.replace(/^\/+/, "");
  if (relative.startsWith("images/")) {
    relative = relative.slice("images/".length);
  }

  const api = getDesktopApi();
  if (api?.resolveFileSrc) {
    const resolved = api.resolveFileSrc(projectName, relative);
    if (typeof resolved === "string" && resolved.trim()) return resolved;
    if (isLikelyProjectImagePath(relative)) {
      const withImages = `images/${relative}`;
      const resolvedImages = api.resolveFileSrc(projectName, withImages);
      if (typeof resolvedImages === "string" && resolvedImages.trim()) {
        return resolvedImages;
      }
    }
  }

  if (isLikelyProjectImagePath(relative) || textureRef.includes("images/")) {
    return buildProjectAssetUrl("project-images", projectName, relative);
  }
  return buildProjectAssetUrl("project-models", projectName, relative);
}

function drawVelvet(ctx: CanvasRenderingContext2D, size: number, tint: string) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = ((x * 17 + y * 31) % 100) / 100;
      ctx.fillStyle = `rgba(255,255,255,${0.03 + n * 0.07})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "rgba(255,255,255,0.12)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
}

function drawCanvas(ctx: CanvasRenderingContext2D, size: number, tint: string) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(60,45,30,0.18)";
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
}

function drawWood(ctx: CanvasRenderingContext2D, size: number, tint: string) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 6) {
    const shade = 0.85 + ((y * 13) % 20) / 100;
    ctx.fillStyle = `rgba(0,0,0,${0.08 * (1 - shade + 0.85)})`;
    ctx.fillRect(0, y, size, 2);
  }
  for (let x = 0; x < size; x += 24) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, 0, 3, size);
  }
}

function drawConcrete(ctx: CanvasRenderingContext2D, size: number, tint: string) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 47) % size;
    const y = (i * 83) % size;
    const r = 1 + (i % 3);
    ctx.fillStyle = `rgba(255,255,255,${0.04 + (i % 5) * 0.02})`;
    ctx.fillRect(x, y, r, r);
  }
}

export function createDecorPresetCanvas(presetId: DecorTexturePresetId): HTMLCanvasElement {
  const preset = DECOR_TEXTURE_PRESETS.find((item) => item.id === presetId);
  const tint = preset?.tint ?? "#888888";
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (presetId.startsWith("velvet-")) {
    drawVelvet(ctx, size, tint);
  } else if (presetId === "canvas-beige") {
    drawCanvas(ctx, size, tint);
  } else if (presetId === "wood-oak") {
    drawWood(ctx, size, tint);
  } else {
    drawConcrete(ctx, size, tint);
  }
  return canvas;
}

/** Плиток текстуры на 1 метр (режим «Плитка») */
export function resolveDecorTextureMapping(
  model: {
    decorTextureMode?: DecorTextureMode;
    decorTextureRepeat?: number;
  },
  surfaceWidth: number,
  surfaceHeight: number,
  textureAspect = 1,
): DecorTextureMapping {
  const mode = model.decorTextureMode ?? "repeat";
  const meshAspect = surfaceWidth / Math.max(surfaceHeight, 1e-6);
  const texAspect = Math.max(textureAspect, 1e-6);

  if (mode === "repeat") {
    const tiles = model.decorTextureRepeat ?? 0.75;
    return {
      repeatU: Math.max(0.25, surfaceWidth * tiles),
      repeatV: Math.max(0.25, surfaceHeight * tiles),
      offsetU: 0,
      offsetV: 0,
      clamp: false,
    };
  }

  if (mode === "once" || mode === "contain") {
    const scale = mode === "once" ? clampTextureScale(model.decorTextureRepeat, 1) : 1;
    return resolveAspectFitTextureMapping(meshAspect, texAspect, scale);
  }

  if (meshAspect > texAspect) {
    const repeatU = meshAspect / texAspect;
    return {
      repeatU,
      repeatV: 1,
      offsetU: (1 - repeatU) / 2,
      offsetV: 0,
      clamp: true,
    };
  }

  const repeatV = texAspect / meshAspect;
  return {
    repeatU: 1,
    repeatV,
    offsetU: 0,
    offsetV: (1 - repeatV) / 2,
    clamp: true,
  };
}
