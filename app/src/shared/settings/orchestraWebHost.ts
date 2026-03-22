/**
 * Приложение оркестра на проде сидит под префиксом `/orkestr/` (dopamin…/orkestr/).
 * Локально — обычно base `/`, тогда проверяем префикс пути.
 */
export function isOrchestraWebAppSubpath(): boolean {
  if (typeof window === "undefined") return false;
  const raw = String((import.meta as any).env?.BASE_URL ?? "/");
  const base = raw.replace(/\/$/, "") || "/";
  if (base !== "/" && base !== "") return true;
  return window.location.pathname.startsWith("/orkestr");
}
