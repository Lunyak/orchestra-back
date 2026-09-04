export function readSelectedProjectSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("selectedProject");
    return stored?.trim() || null;
  } catch {
    return null;
  }
}
