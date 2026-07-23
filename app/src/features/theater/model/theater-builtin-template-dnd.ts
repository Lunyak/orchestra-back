import type { TheaterBuiltinTemplateKey } from "./theater-model-builtin";
import { isTheaterBuiltinTemplateKey } from "./theater-model-builtin";

export const THEATER_BUILTIN_TEMPLATE_MIME =
  "application/x-orchestra-theater-builtin";

export function writeTheaterBuiltinTemplateDrag(
  dataTransfer: DataTransfer,
  key: TheaterBuiltinTemplateKey,
) {
  dataTransfer.setData(THEATER_BUILTIN_TEMPLATE_MIME, key);
  dataTransfer.setData("text/plain", key);
  dataTransfer.effectAllowed = "copy";
}

export function readTheaterBuiltinTemplateDrag(
  dataTransfer: DataTransfer | null,
): TheaterBuiltinTemplateKey | null {
  if (!dataTransfer) return null;
  const raw =
    dataTransfer.getData(THEATER_BUILTIN_TEMPLATE_MIME) ||
    dataTransfer.getData("text/plain");
  return isTheaterBuiltinTemplateKey(raw) ? raw : null;
}

export function isTheaterBuiltinTemplateDrag(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types);
  return (
    types.includes(THEATER_BUILTIN_TEMPLATE_MIME) ||
    types.includes("text/plain")
  );
}
