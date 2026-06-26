/** Переносит значение legacy-ключа в новый и удаляет старый. */
export function migrateLegacyStorageKey(legacyKey: string, newKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy == null) return;
    if (localStorage.getItem(newKey) == null) {
      localStorage.setItem(newKey, legacy);
    }
    localStorage.removeItem(legacyKey);
  } catch {
    // ignore
  }
}
