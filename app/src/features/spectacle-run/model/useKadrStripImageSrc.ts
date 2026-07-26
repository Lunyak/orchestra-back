import { useCallback, useEffect, useRef, useState } from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  decodeOrchestraImageStorageKey,
  storageKeyToImageBasename,
} from "../../../shared/utils/markdownImages";
import { fetchImageStreamBlobUrl, getPlayUrl } from "../../../sync/api/files";

function resolveProjectRelativeImageSrc(projectName: string, src: string): string {
  const trimmed = src.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  let path = trimmed.replace(/^\.?\//, "");
  if (!path.startsWith("images/")) return trimmed;

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
}

function resolveOrchestraImageLocal(projectName: string, href: string): string | null {
  if (!getDesktopApi()?.invoke) return null;
  const key = decodeOrchestraImageStorageKey(href.replace(/^orchestra-image:/i, "").trim());
  const basename = storageKeyToImageBasename(key);
  if (!basename) return null;
  return resolveProjectRelativeImageSrc(projectName, `images/${basename}`);
}

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

async function resolveOrchestraImageSrc(
  projectName: string,
  href: string,
  streamOnly: boolean,
): Promise<{ src: string | null; blob: boolean }> {
  const local = resolveOrchestraImageLocal(projectName, href);
  if (local) return { src: local, blob: false };

  const key = decodeOrchestraImageStorageKey(href.replace(/^orchestra-image:/i, "").trim());
  const accessToken = readAccessToken();
  if (!accessToken || !key) return { src: null, blob: false };

  const blob = await fetchImageStreamBlobUrl(accessToken, key);
  if (blob) return { src: blob, blob: true };
  if (streamOnly) return { src: null, blob: false };

  try {
    const { url } = await getPlayUrl(accessToken, key);
    return url ? { src: url, blob: false } : { src: null, blob: false };
  } catch {
    return { src: null, blob: false };
  }
}

export function useKadrStripImageSrc(
  projectName: string,
  href: string | null | undefined,
): { src: string | null; onImageError: () => void } {
  const [src, setSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  const streamRetriedRef = useRef(false);

  useEffect(() => {
    streamRetriedRef.current = false;
  }, [href]);

  useEffect(() => {
    const rawHref = String(href ?? "").trim();
    if (!rawHref) {
      setSrc(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (/^https?:\/\//i.test(rawHref)) {
        if (!cancelled) setSrc(rawHref);
        return;
      }

      if (rawHref.startsWith("orchestra-image:")) {
        const result = await resolveOrchestraImageSrc(projectName, rawHref, false);
        if (cancelled) {
          if (result.blob && result.src) URL.revokeObjectURL(result.src);
          return;
        }
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = null;
        }
        if (result.blob && result.src) blobRef.current = result.src;
        setSrc(result.src);
        return;
      }

      const resolved = resolveProjectRelativeImageSrc(projectName, rawHref);
      if (!cancelled) setSrc(resolved);
    };

    void run();

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [projectName, href]);

  const onImageError = useCallback(() => {
    const rawHref = String(href ?? "").trim();
    if (rawHref.startsWith("orchestra-image:")) {
      if (streamRetriedRef.current || blobRef.current) {
        setSrc(null);
        return;
      }
      streamRetriedRef.current = true;

      void resolveOrchestraImageSrc(projectName, rawHref, true).then((result) => {
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = null;
        }
        if (result.blob && result.src) blobRef.current = result.src;
        setSrc(result.src);
      });
      return;
    }

    // Битая локальная/remote картинка — освобождаем обложку под заставку/видео.
    setSrc(null);
  }, [projectName, href]);

  return { src, onImageError };
}
