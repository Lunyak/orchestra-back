import type { SoundLinkPayload } from "./markdown-preview-types";

export type MarkdownPreviewSoundOption = {
  id: number;
  title: string;
  icon?: string;
  iconRemoteUrl?: string;
};

export function createResolveImageSrc(projectName: string) {
  return (src?: string): string | undefined => {
    if (!src) return src;

    let path = src.trim().replace(/^\.?\//, "");

    if (!path.startsWith("images/")) {
      return src;
    }

    path = path.replace(/^images\//, "").replace(/^\/+/, "");

    const pathSegments = path.split("/").map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join("/");

    let projectId: string | null = null;
    if (typeof window !== "undefined") {
      try {
        projectId = window.localStorage.getItem(`projectId:${projectName}`);
      } catch {
        // ignore
      }
    }

    const baseUrl = new URL(`project-images://${encodeURIComponent(projectName)}/`);
    baseUrl.pathname = projectId
      ? `/${encodeURIComponent(projectId)}/${encodedPath}`
      : `/${encodedPath}`;

    return baseUrl.toString();
  };
}

export function createResolveSoundIconSrc(projectName: string) {
  return (iconFile: string): string => {
    const safe = String(iconFile ?? "").trim();
    if (!safe) return "";
    let projectId: string | null = null;
    if (typeof window !== "undefined") {
      try {
        projectId = window.localStorage.getItem(`projectId:${projectName}`);
      } catch {
        // ignore
      }
    }
    const url = new URL(`project-sound-icons://${encodeURIComponent(projectName)}/`);
    const encodedFile = encodeURIComponent(safe);
    url.pathname = projectId
      ? `/${encodeURIComponent(projectId)}/${encodedFile}`
      : `/${encodedFile}`;
    return url.toString();
  };
}

export function createResolveSoundIconFromPayload(
  getSoundsOptions: () => ReadonlyArray<MarkdownPreviewSoundOption>,
  resolveSoundIconSrc: (iconFile: string) => string,
) {
  return (payload: SoundLinkPayload): string | null => {
    const opts = getSoundsOptions();
    const byId =
      "id" in payload
        ? opts.find((s) => Number(s?.id) === Number(payload.id)) ?? null
        : null;
    const byName =
      "name" in payload
        ? opts.find(
            (s) =>
              String(s?.title ?? "").toLowerCase() === String(payload.name ?? "").toLowerCase(),
          ) ?? null
        : null;
    const sound = byId ?? byName;
    if (!sound) return null;
    const remote = String(sound.iconRemoteUrl ?? "").trim();
    if (remote && /^https?:\/\//i.test(remote)) return remote;
    const icon = String(sound.icon ?? "").trim();
    if (icon) return resolveSoundIconSrc(icon);
    return null;
  };
}
