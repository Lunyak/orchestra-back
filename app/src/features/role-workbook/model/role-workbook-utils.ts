export function normalizeWorkbookEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}
