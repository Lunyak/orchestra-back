export const ORCHESTRA_MODEL_PREFIX = "orchestra-model:";

export function encodeOrchestraModelRef(storageKey: string): string {
  return `${ORCHESTRA_MODEL_PREFIX}${encodeURIComponent(storageKey.trim())}`;
}

export function decodeOrchestraModelKey(fileRef: string): string | null {
  const raw = String(fileRef ?? "").trim();
  if (!raw.toLowerCase().startsWith(ORCHESTRA_MODEL_PREFIX)) return null;
  const encoded = raw.slice(ORCHESTRA_MODEL_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function isOrchestraModelRef(fileRef: string): boolean {
  return decodeOrchestraModelKey(fileRef) != null;
}
