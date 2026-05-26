export type MobileAssetKind =
  | "playlist"
  | "sound"
  | "sound-icon"
  | "image"
  | "model"
  | "decor-texture";

export function projectRoot(projectSlug: string): string {
  return `orchestra/projects/${encodeURIComponent(projectSlug)}`;
}

export function assetRelativePath(
  projectSlug: string,
  kind: MobileAssetKind,
  fileName: string,
): string {
  const safe = fileName.replace(/[/\\]/g, "_");
  const folder =
    kind === "playlist"
      ? "playlist"
      : kind === "sound"
        ? "sounds"
        : kind === "sound-icon"
          ? "sound-icons"
          : kind === "model"
            ? "models"
            : kind === "decor-texture"
              ? "textures"
              : "images";
  return `${projectRoot(projectSlug)}/${folder}/${safe}`;
}

export function scriptRelativePath(projectSlug: string): string {
  return `${projectRoot(projectSlug)}/script.json`;
}
