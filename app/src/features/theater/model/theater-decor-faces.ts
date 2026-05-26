import type { TheaterModel } from "../../../shared/types/script";

export type DecorTextureFace = "front" | "back" | "top" | "bottom";

export const DECOR_TEXTURE_FACE_OPTIONS: {
  id: DecorTextureFace;
  label: string;
}[] = [
  { id: "front", label: "Спереди" },
  { id: "back", label: "Сзади" },
  { id: "top", label: "Сверху" },
  { id: "bottom", label: "Снизу" },
];

const VALID_FACES = new Set<string>(DECOR_TEXTURE_FACE_OPTIONS.map((item) => item.id));

const DEFAULT_FACES_BY_BUILTIN: Partial<
  Record<NonNullable<TheaterModel["builtin"]>, DecorTextureFace[]>
> = {
  flat: ["front", "back"],
  platform: ["front", "back", "top"],
  screen: ["front", "back"],
};

export function normalizeDecorTextureFaces(
  value: unknown,
): DecorTextureFace[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const faces = value.filter(
    (item): item is DecorTextureFace =>
      typeof item === "string" && VALID_FACES.has(item),
  );
  return faces.length > 0 ? faces : undefined;
}

export function resolveDecorTextureFaces(
  model: Pick<TheaterModel, "builtin" | "decorTextureFaces">,
): DecorTextureFace[] {
  const custom = normalizeDecorTextureFaces(model.decorTextureFaces);
  if (custom) return custom;
  if (model.builtin && DEFAULT_FACES_BY_BUILTIN[model.builtin]) {
    return [...DEFAULT_FACES_BY_BUILTIN[model.builtin]!];
  }
  return ["front"];
}

export function supportsDecorTextureFaces(
  builtin: TheaterModel["builtin"] | undefined,
): boolean {
  return builtin === "flat" || builtin === "platform" || builtin === "screen";
}

export function toggleDecorTextureFace(
  faces: DecorTextureFace[] | undefined,
  builtin: TheaterModel["builtin"],
  face: DecorTextureFace,
): DecorTextureFace[] {
  const current = faces?.length
    ? [...faces]
    : [...resolveDecorTextureFaces({ builtin, decorTextureFaces: faces })];
  const index = current.indexOf(face);
  if (index >= 0) {
    if (current.length <= 1) return current;
    current.splice(index, 1);
    return current;
  }
  current.push(face);
  return current;
}
