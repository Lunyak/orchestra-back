/** URL для файлов проекта (images, models) — как в редакторе сценария. */

export function readProjectIdFromStorage(projectName: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`projectId:${projectName}`);
  } catch {
    return null;
  }
}

export function buildProjectAssetUrl(
  scheme: "project-images" | "project-models",
  projectName: string,
  relativePath: string,
): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const encodedPath = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const projectId = readProjectIdFromStorage(projectName);
  const baseUrl = new URL(`${scheme}://${encodeURIComponent(projectName)}/`);
  baseUrl.pathname = projectId
    ? `/${encodeURIComponent(projectId)}/${encodedPath}`
    : `/${encodedPath}`;
  return baseUrl.toString();
}

export function isLikelyProjectImagePath(relativePath: string): boolean {
  const path = relativePath.replace(/\\/g, "/").toLowerCase();
  return (
    path.startsWith("images/") ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(path)
  );
}
