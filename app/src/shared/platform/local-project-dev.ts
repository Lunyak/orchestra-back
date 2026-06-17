/** Dev-сервер (npm run dev): чтение проектов и медиа с локального диска без Electron. */

export function isDevLocalProjectsEnabled(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function localProjectMediaDevUrl(
  projectSlug: string,
  kind: "playlist" | "sound" | "video" | "image",
  fileName: string,
  titleHint?: string,
): string | null {
  if (!isDevLocalProjectsEnabled() || !projectSlug) return null;
  const clean = String(fileName ?? "")
    .trim()
    .replace(/^.*[/\\]/, "");
  if (!clean && !String(titleHint ?? "").trim()) return null;
  const folder =
    kind === "video"
      ? "videos"
      : kind === "image"
        ? "images"
        : kind === "playlist"
          ? "playlist"
          : "sounds";
  const fileSeg = clean ? encodeURIComponent(clean) : "_";
  let url = `/local-project-media/${encodeURIComponent(projectSlug)}/${folder}/${fileSeg}`;
  const title = String(titleHint ?? "").trim();
  if (title) url += `?title=${encodeURIComponent(title)}`;
  return url;
}

export async function fetchDevLocalProjectJson(
  projectSlug: string,
  kind: "script" | "notes-run",
): Promise<Record<string, unknown> | null> {
  if (!isDevLocalProjectsEnabled() || !projectSlug) return null;
  try {
    const file = kind === "notes-run" ? "notes-run.json" : "script.json";
    const res = await fetch(
      `/local-project-scenes/${encodeURIComponent(projectSlug)}/${file}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export async function pingDevLocalProjects(): Promise<{
  ok: boolean;
  mediaRoot?: string | null;
}> {
  if (!isDevLocalProjectsEnabled()) return { ok: false };
  try {
    const res = await fetch("/local-project-dev/ping");
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; mediaRoot?: string | null };
    return { ok: Boolean(data?.ok), mediaRoot: data?.mediaRoot ?? null };
  } catch {
    return { ok: false };
  }
}

export type DevScannedMedia = {
  ok: boolean;
  mediaRoot?: string;
  videos: Array<{ id: number; title: string; file: string }>;
  holdImages: Array<{ id: number; title: string; file: string }>;
  sounds: Array<{ id: number; title: string; file: string }>;
  error?: string;
};

type ScannedItem = { id: number; title: string; file: string; filePath?: string };

function normMediaTitle(value: string): string {
  return value.trim().toLowerCase();
}

function findScannedMediaMatch(
  item: { title?: string; file?: string },
  scanned: ScannedItem[],
): ScannedItem | undefined {
  const title = normMediaTitle(String(item.title ?? ""));
  const file = String(item.file ?? "")
    .replace(/^.*[/\\]/, "")
    .toLowerCase();
  return scanned.find((candidate) => {
    if (title && normMediaTitle(candidate.title) === title) return true;
    if (file && candidate.file.toLowerCase() === file) return true;
    return false;
  });
}

/** Сохраняет id из карточек/сервера, подставляет локальные file с Desktop/xxx. */
export function mergeDevScannedProjectorMedia<
  TV extends {
    id: number;
    title: string;
    file: string;
    remoteKey?: string;
    remoteUrl?: string;
    filePath?: string;
  },
  TH extends {
    id: number;
    title: string;
    file: string;
    remoteKey?: string;
    remoteUrl?: string;
    filePath?: string;
  },
>(
  prevVideos: TV[],
  prevHolds: TH[],
  scanned: Pick<DevScannedMedia, "videos" | "holdImages">,
): { videos: TV[]; holdImages: TH[] } {
  const mergeList = <T extends TV | TH>(
    prev: T[],
    scannedItems: ScannedItem[],
    create: (item: ScannedItem, id: number) => T,
  ): T[] => {
    const used = new Set<number>();
    const merged = prev.map((entry) => {
      const match = findScannedMediaMatch(entry, scannedItems);
      if (!match) return entry;
      used.add(match.id);
      return {
        ...entry,
        file: match.file,
        title: entry.title?.trim() ? entry.title : match.title,
        filePath: match.filePath ?? entry.filePath,
        remoteKey: undefined,
        remoteUrl: undefined,
      };
    });
    let nextId =
      Math.max(
        0,
        ...prev.map((item) => Number(item.id)),
        ...scannedItems.map((item) => item.id),
      ) + 1;
    for (const item of scannedItems) {
      if (used.has(item.id)) continue;
      merged.push(create(item, nextId++));
    }
    return merged;
  };

  return {
    videos: mergeList(prevVideos, scanned.videos, (item, id) => ({
      id,
      title: item.title,
      file: item.file,
      filePath: item.filePath,
    })) as TV[],
    holdImages: mergeList(prevHolds, scanned.holdImages, (item, id) => ({
      id,
      title: item.title,
      file: item.file,
      filePath: item.filePath,
    })) as TH[],
  };
}

export async function fetchDevScannedMedia(mediaRootOverride?: string | null): Promise<DevScannedMedia> {
  if (!isDevLocalProjectsEnabled()) {
    return { ok: false, videos: [], holdImages: [], sounds: [], error: "Not in dev mode" };
  }
  try {
    const query =
      mediaRootOverride != null && String(mediaRootOverride).trim()
        ? `?root=${encodeURIComponent(String(mediaRootOverride).trim())}`
        : "";
    const res = await fetch(`/local-project-dev/scan-media${query}`);
    const data = (await res.json()) as DevScannedMedia;
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        videos: [],
        holdImages: [],
        sounds: [],
        error: data?.error ?? "scan-media failed",
      };
    }
    return {
      ok: true,
      mediaRoot: data.mediaRoot,
      videos: Array.isArray(data.videos) ? data.videos : [],
      holdImages: Array.isArray(data.holdImages) ? data.holdImages : [],
      sounds: Array.isArray(data.sounds) ? data.sounds : [],
    };
  } catch (err) {
    return {
      ok: false,
      videos: [],
      holdImages: [],
      sounds: [],
      error: String((err as Error)?.message ?? err),
    };
  }
}

export async function registerDevProjectMediaRoot(
  projectSlug: string,
  mediaRoot: string,
): Promise<void> {
  if (!isDevLocalProjectsEnabled() || !projectSlug || !mediaRoot.trim()) return;
  try {
    await fetch("/local-project-dev/set-project-media-root", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: projectSlug, root: mediaRoot.trim() }),
    });
  } catch {
    /* dev server may be offline */
  }
}
