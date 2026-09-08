import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  buildProjectAssetUrl,
  isLikelyProjectImagePath,
} from "./theater-decor-asset-url";

export type DecorTexturePresetId =
  | "velvet"
  | "canvas-beige"
  | "wood-oak"
  | "concrete-gray";

const LEGACY_VELVET_PRESET_IDS = new Set([
  "velvet-crimson",
  "velvet-navy",
  "velvet-gold",
]);

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
};

export const DECOR_TEXTURE_PRESETS: DecorTexturePreset[] = [
  { id: "velvet", label: "Бархат" },
  { id: "canvas-beige", label: "Холст" },
  { id: "wood-oak", label: "Дерево" },
  { id: "concrete-gray", label: "Бетон" },
];

export const DECOR_TEXTURE_PRESET_PREFIX = "preset:" as const;
export const DECOR_TEXTURE_FILE_PREFIX = "file:" as const;

export function getDecorTexturePresetId(
  value: string | undefined,
): DecorTexturePresetId | null {
  if (!value?.startsWith(DECOR_TEXTURE_PRESET_PREFIX)) return null;
  const raw = value.slice(DECOR_TEXTURE_PRESET_PREFIX.length);
  if (raw === "velvet" || LEGACY_VELVET_PRESET_IDS.has(raw)) return "velvet";
  if (raw === "canvas-beige" || raw === "wood-oak" || raw === "concrete-gray") {
    return raw;
  }
  return null;
}

export function isDecorTexturePreset(
  value: string | undefined,
): value is `${typeof DECOR_TEXTURE_PRESET_PREFIX}${DecorTexturePresetId}` {
  return getDecorTexturePresetId(value) != null;
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

function drawVelvet(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#f3eef1";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 5) {
    const n = ((x * 17) % 100) / 100;
    ctx.fillStyle = `rgba(0,0,0,${0.1 + n * 0.22})`;
    ctx.fillRect(x, 0, 3, size);
  }
  for (let y = 0; y < size; y += 10) {
    const n = ((y * 13) % 100) / 100;
    ctx.fillStyle = `rgba(0,0,0,${0.05 + n * 0.12})`;
    ctx.fillRect(0, y, size, 4);
  }
  const grad = ctx.createLinearGradient(0, 0, size * 0.75, size);
  grad.addColorStop(0, "rgba(255,255,255,0.38)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
}

function drawCanvas(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(0,0,0,0.16)";
  ctx.lineWidth = 2;
  for (let i = -size; i < size * 2; i += 10) {
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

function drawWood(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#f0e6d4";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 8) {
    const shade = ((y * 13) % 20) / 100;
    ctx.fillStyle = `rgba(0,0,0,${0.08 + shade})`;
    ctx.fillRect(0, y, size, 3);
  }
  for (let x = 0; x < size; x += 28) {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x, 0, 4, size);
  }
}

function drawConcrete(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#ececec";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i += 1) {
    const x = (i * 47) % size;
    const y = (i * 83) % size;
    const r = 3 + (i % 5);
    ctx.fillStyle = `rgba(0,0,0,${0.06 + (i % 5) * 0.03})`;
    ctx.fillRect(x, y, r, r);
  }
}

export function createDecorPresetCanvas(presetId: DecorTexturePresetId): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (presetId.startsWith("velvet")) {
    drawVelvet(ctx, size);
  } else if (presetId === "canvas-beige") {
    drawCanvas(ctx, size);
  } else if (presetId === "wood-oak") {
    drawWood(ctx, size);
  } else {
    drawConcrete(ctx, size);
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
