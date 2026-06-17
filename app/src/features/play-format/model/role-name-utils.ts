import { isCastDescriptorRole } from "./cast-descriptor-words";

const GARBAGE_ROLE_RE =
  /^(?:fb2|zip|ocr|leshka|м|а|и|в|к|с|у|о)$/i;

const BIBLIOGRAPHIC_RE =
  /(?:собрание\s+сочинений|художественная\s+литература|булгаков,\s*собрание)/i;

/** «ЗояДенисовнаПельц» → «Зоя Денисовна Пельц». */
export function splitRussianCamelCase(name: string): string {
  return String(name ?? "")
    .trim()
    .replace(/([а-яё])([А-ЯЁ])/g, "$1 $2")
    .replace(/([А-ЯЁ])([А-ЯЁ][а-яё])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCastRoleName(raw: string): string {
  const trimmed = String(raw ?? "")
    .trim()
    .replace(/[,.;]+$/g, "")
    .replace(/\s+/g, " ");
  if (!trimmed) return "";
  return splitRussianCamelCase(trimmed);
}

export function isGarbageRoleName(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return true;
  if (trimmed.length < 2) return true;
  if (GARBAGE_ROLE_RE.test(trimmed)) return true;
  if (BIBLIOGRAPHIC_RE.test(trimmed)) return true;
  if (/^[A-Za-z0-9]{1,5}$/.test(trimmed) && !/[А-ЯЁа-яё]/.test(trimmed)) return true;
  if (/^\[\[/.test(trimmed)) return true;
  if (isCastDescriptorRole(trimmed)) return true;
  return false;
}

export function filterDetectedRoleNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of names) {
    const name = normalizeCastRoleName(raw);
    if (!name || isGarbageRoleName(name)) continue;
    const key = name.toLowerCase().replace(/ё/g, "е");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}
