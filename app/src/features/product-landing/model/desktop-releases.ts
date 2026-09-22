import { api } from "../../../sync/api/client";

export type DesktopReleasePlatform = "windows" | "mac" | "linux";

export type DesktopReleaseArtifact = {
  fileName: string;
  platform: DesktopReleasePlatform;
  label: string;
  size: number;
};

export type DesktopRelease = {
  version: string;
  publishedAt: string | null;
  artifacts: DesktopReleaseArtifact[];
};

export type DesktopReleasesResponse = {
  latest: DesktopRelease | null;
  releases: DesktopRelease[];
};

export async function fetchDesktopReleases(): Promise<DesktopReleasesResponse> {
  const { data } = await api.get<DesktopReleasesResponse>("/desktop-releases");
  return data;
}

export function desktopReleaseFileUrl(version: string, fileName: string): string {
  const base = String(api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/desktop-releases/${encodeURIComponent(version)}/${encodeURIComponent(fileName)}`;
}

export function detectPreferredDesktopPlatform(): DesktopReleasePlatform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux")) return "linux";
  return null;
}

export function pickPreferredArtifact(
  release: DesktopRelease | null,
  platform: DesktopReleasePlatform | null,
): DesktopReleaseArtifact | null {
  if (!release) return null;
  if (platform) {
    const match = release.artifacts.find((item) => item.platform === platform);
    if (match) return match;
  }
  return release.artifacts[0] ?? null;
}

export function formatReleaseSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${Math.max(1, Math.round(kb))} КБ`;
  }
  const digits = mb >= 10 ? 0 : 1;
  return `${mb.toFixed(digits)} МБ`;
}

export function formatReleaseDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ru-RU");
}
