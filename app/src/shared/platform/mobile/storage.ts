import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { getApiBaseUrl } from "../../../sync/api/client";
import { assetRelativePath, scriptRelativePath, type MobileAssetKind } from "./paths";

function normalizeFetchUrl(url: string): string {
  const u = String(url ?? "").trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  const base = getApiBaseUrl().replace(/\/$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(path: string): Promise<void> {
  const parts = path.split("/");
  parts.pop();
  let acc = "";
  for (const p of parts) {
    if (!p) continue;
    acc = acc ? `${acc}/${p}` : p;
    try {
      await Filesystem.mkdir({
        path: acc,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      /* already exists */
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function readProjectScene(
  projectSlug: string,
  sceneName: string,
): Promise<Record<string, unknown> | null> {
  if (sceneName !== "script") return null;
  const path = scriptRelativePath(projectSlug);
  try {
    const { data } = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(String(data)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function saveProjectScene(
  projectSlug: string,
  sceneName: string,
  payload: Record<string, unknown>,
  _opts?: { skipOutbox?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (sceneName !== "script") {
    return { ok: false, error: "only script scene supported on mobile" };
  }
  const path = scriptRelativePath(projectSlug);
  try {
    await ensureParentDir(path);
    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data: JSON.stringify(payload),
      encoding: Encoding.UTF8,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export async function downloadRemoteAsset(args: {
  projectName: string;
  projectId: string | null;
  kind: MobileAssetKind;
  fileName: string;
  url: string;
  accessToken: string;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  absolutePath?: string;
  error?: string;
}> {
  const rel = assetRelativePath(args.projectName, args.kind, args.fileName);
  if (await fileExists(rel)) {
    const { uri } = await Filesystem.getUri({ path: rel, directory: Directory.Data });
    return { ok: true, skipped: true, absolutePath: uri };
  }

  const fetchUrl = normalizeFetchUrl(args.url);
  try {
    const res = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) {
      return { ok: false, error: "empty response" };
    }
    await ensureParentDir(rel);
    await Filesystem.writeFile({
      path: rel,
      directory: Directory.Data,
      data: arrayBufferToBase64(buf),
    });
    const { uri } = await Filesystem.getUri({ path: rel, directory: Directory.Data });
    const absolutePath =
      Capacitor.getPlatform() === "android" ? uri : Capacitor.convertFileSrc(uri);
    return { ok: true, skipped: false, absolutePath };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export function resolveFileSrc(absolutePath: string): string {
  if (!absolutePath) return absolutePath;
  if (/^https?:\/\//i.test(absolutePath)) return absolutePath;
  return Capacitor.convertFileSrc(absolutePath);
}

export async function mobileInvoke(
  channel: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  if (channel === "download-remote-asset") {
    return downloadRemoteAsset(payload as Parameters<typeof downloadRemoteAsset>[0]);
  }
  return { ok: false, error: `unknown channel: ${channel}` };
}
