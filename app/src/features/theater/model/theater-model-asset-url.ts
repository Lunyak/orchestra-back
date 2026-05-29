import { useEffect, useState } from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  decodeOrchestraModelKey,
  isOrchestraModelRef,
} from "../../../shared/project-assets/orchestraModelRef";
import { getPlayUrl } from "../../../sync/api/files";
import { buildProjectAssetUrl } from "./theater-decor-asset-url";

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

export function resolveTheaterModelFileUrlSync(
  projectName: string,
  fileRef: string,
): string | null {
  const file = String(fileRef ?? "").trim();
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  if (isOrchestraModelRef(file)) return null;

  const relative = file.replace(/^\/+/, "");
  const api = getDesktopApi();
  if (api?.resolveFileSrc) {
    const resolved = api.resolveFileSrc(projectName, relative);
    if (typeof resolved === "string" && resolved.trim()) return resolved;
    if (!relative.startsWith("models/")) {
      const withModels = `models/${relative}`;
      const resolvedModels = api.resolveFileSrc(projectName, withModels);
      if (typeof resolvedModels === "string" && resolvedModels.trim()) {
        return resolvedModels;
      }
    }
  }

  return buildProjectAssetUrl("project-models", projectName, relative);
}

export function useTheaterModelFileUrl(
  projectName: string,
  fileRef: string | undefined,
): string | null {
  const file = String(fileRef ?? "").trim();
  const storageKey = file ? decodeOrchestraModelKey(file) : null;
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setRemoteUrl(null);
      return;
    }
    const token = readAccessToken();
    if (!token) {
      setRemoteUrl(null);
      return;
    }
    let cancelled = false;
    void getPlayUrl(token, storageKey)
      .then((res) => {
        if (!cancelled) setRemoteUrl(res?.url?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setRemoteUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  if (!file) return null;

  const syncUrl = resolveTheaterModelFileUrlSync(projectName, file);
  if (syncUrl) return syncUrl;
  return remoteUrl;
}
