/** Слова описания роли в списке персонажей — не имена. */
export const CAST_DESCRIPTOR_WORDS = new Set([
  "вдова",
  "вдовец",
  "лет",
  "года",
  "год",
  "администратор",
  "горничная",
  "председатель",
  "коммерческий",
  "директор",
  "китаец",
  "член",
  "очень",
  "ответственная",
  "ответственный",
  "ответственное",
  "безответственная",
  "безответственный",
  "дама",
  "дам",
  "металлов",
  "тугоплавких",
  "треста",
  "коллегии",
  "защитников",
  "домкома",
  "горничная",
  "ремонтный",
]);

export function isCastDescriptorToken(word: string): boolean {
  const bare = String(word ?? "")
    .trim()
    .replace(/[,.;]+$/g, "")
    .toLowerCase()
    .replace(/ё/g, "е");
  if (!bare) return true;
  if (CAST_DESCRIPTOR_WORDS.has(bare)) return true;
  if (/^\d+-?х?$/.test(bare)) return true;
  if (/^\d+$/.test(bare)) return true;
  return false;
}

export function isCastDescriptorRole(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (words.length === 1 && isCastDescriptorToken(words[0] ?? "")) return true;
  if (words.every((word) => isCastDescriptorToken(word))) return true;
  return false;
}

/** Строка — обрывок описания (только «лет», цифра и т.п.). */
export function isCastLineFragment(line: string): boolean {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return true;
  if (/^\d+(?:-\w+)?\s*(?:лет|года|год)?\.?$/i.test(trimmed)) return true;
  if (/^(?:лет|года|год)\.?$/i.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((word) => isCastDescriptorToken(word));
}
