export function normalizeActorKey(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

export function normalizeRoleKeyForStorage(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}
