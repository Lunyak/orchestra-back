/**
 * Generates a stable unique id for client-side entities.
 *
 * Uses `crypto.randomUUID()` when available (modern browsers / Node 16.17+ / Electron).
 * Falls back to RFC4122 v4 UUID built from `crypto.getRandomValues()` for older runtimes.
 * As a last resort uses a non-crypto random string (still fine for local ids).
 */
export function createId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? ((globalThis as any).crypto as Crypto | undefined) : undefined;

  // Prefer native randomUUID if present.
  const maybeRandomUUID = (c as any)?.randomUUID as undefined | (() => string);
  if (typeof maybeRandomUUID === "function") {
    return maybeRandomUUID.call(c);
  }

  // RFC4122 v4 using getRandomValues (widely supported, incl. older Chromium/Electron).
  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    // Set version to 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant to RFC4122
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  // Last resort: not cryptographically strong, but good enough for local keys.
  return `id_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}
