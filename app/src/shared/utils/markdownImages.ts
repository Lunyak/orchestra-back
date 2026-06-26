import type { ScriptScene } from "../types/script";

/**
 * Картинки в маркдауне: при сохранении сцены оставляем в images только те, на которые есть ссылки.
 * Неиспользуемые ключи убираются из payload → при пуше бэкенд удаляет их из MinIO (sync.service).
 * Так хранилище не засоряется.
 */

export function stripMarkdownCodeFences(text: string): string {
  return String(text ?? "").replace(/```[\s\S]*?```/g, "");
}

/** Декодирует ключ из `orchestra-image:…` (в т.ч. старые двойные encodeURIComponent). */
export function decodeOrchestraImageStorageKey(encoded: string): string {
  let key = String(encoded ?? "").trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(key);
      if (next === key) break;
      key = next;
    } catch {
      break;
    }
  }
  return key;
}

/** Последний сегмент ключа в хранилище — имя файла в папке images на диске. */
export function storageKeyToImageBasename(key: string): string {
  const k = String(key ?? "").trim();
  if (!k) return "";
  const norm = k.replace(/\\/g, "/");
  const seg = norm.split("/").filter(Boolean).pop() || norm;
  return seg.replace(/[<>:"|?*]/g, "_");
}

/** Стабильное имя файла для картинки по внешнему URL (кэш в images/). */
export function httpUrlToImageFileName(url: string): string {
  const u = String(url).trim();
  try {
    const parsed = new URL(u);
    const rawSeg = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    const seg = rawSeg.split("?")[0] ?? rawSeg;
    if (seg && /\.[a-z0-9]{2,8}$/i.test(seg) && !seg.includes("..")) {
      return seg.replace(/[<>:"|?*]/g, "_");
    }
  } catch {
    /* ignore */
  }
  let h = 2166136261;
  for (let i = 0; i < u.length; i += 1) {
    h ^= u.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `remote-${(h >>> 0).toString(16)}.bin`;
}

/** Собирает имена файлов картинок, на которые есть ссылки в маркдауне сцен (![alt](path) с path вида ./images/xxx или images/xxx). */
export function getReferencedImageFilenames(scenes: ScriptScene[]): Set<string> {
  const names = new Set<string>();
  // Ссылки на картинки: ![alt](url) — учитываем только относительные пути к images/
  const re = /!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/g;
  for (const scene of scenes) {
    const text = stripMarkdownCodeFences(
      [scene.markdown, scene.playMarkdown, scene.explicationMarkdown].filter(Boolean).join("\n"),
    );
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].trim();
      if (raw.startsWith("data:")) continue;
      if (raw.startsWith("orchestra-image:")) {
        const enc = raw.replace(/^orchestra-image:/i, "").trim();
        let key: string;
        try {
          key = decodeURIComponent(enc);
        } catch {
          key = enc;
        }
        const bn = storageKeyToImageBasename(key);
        if (bn) names.add(bn);
        continue;
      }
      if (/^https?:\/\//i.test(raw)) {
        const bn = httpUrlToImageFileName(raw);
        if (bn) names.add(bn);
        continue;
      }
      if (!/images\/?/i.test(raw)) continue;
      const path = raw.replace(/^\.?\/*/, "").replace(/^images\/?/i, "").trim();
      if (!path) continue;
      const basename = path.split("/").pop() || path;
      if (basename) names.add(basename);
    }
  }
  return names;
}

export type SceneImagesMap = Record<string, { remoteKey?: string; remoteUrl?: string }>;

/** Оставляет в images только те картинки, которые реально упоминаются в сценах. Остальные можно удалить с хранилища при пуше. */
export function pruneSceneImages(
  images: SceneImagesMap | undefined | null,
  scenes: ScriptScene[],
): SceneImagesMap | undefined {
  if (!images || typeof images !== "object") return undefined;
  const referenced = getReferencedImageFilenames(scenes);
  const pruned: SceneImagesMap = {};
  for (const name of referenced) {
    if (images[name]) pruned[name] = images[name];
  }
  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

export type MarkdownImagePrefetchTarget =
  | { kind: "orchestra"; key: string }
  | { kind: "http"; url: string }
  | { kind: "relative"; basename: string };

const MARKDOWN_IMG_RE = /!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/g;
const MARKDOWN_IMG_HREF_RE = /!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/;

export function findFirstMarkdownImageHref(text: string): string | null {
  const match = MARKDOWN_IMG_HREF_RE.exec(stripMarkdownCodeFences(String(text ?? "")));
  return match?.[1]?.trim() ?? null;
}

/**
 * Все картинки из markdown сцен: orchestra-image:, http(s):, относительные images/…
 * (для десктопного офлайн-кэша).
 */
export function collectMarkdownImagePrefetchTargets(scenes: ScriptScene[]): MarkdownImagePrefetchTarget[] {
  const orchestra = new Map<string, true>();
  const http = new Map<string, true>();
  const relative = new Map<string, true>();

  for (const scene of scenes) {
    const text = stripMarkdownCodeFences(
      [scene.markdown, scene.playMarkdown, scene.explicationMarkdown].filter(Boolean).join("\n"),
    );
    let m: RegExpExecArray | null;
    MARKDOWN_IMG_RE.lastIndex = 0;
    while ((m = MARKDOWN_IMG_RE.exec(text)) !== null) {
      const raw = m[1].trim();
      if (raw.startsWith("data:")) continue;
      if (raw.startsWith("orchestra-image:")) {
        const enc = raw.replace(/^orchestra-image:/i, "").trim();
        let key: string;
        try {
          key = decodeURIComponent(enc);
        } catch {
          key = enc;
        }
        if (key) orchestra.set(key, true);
        continue;
      }
      if (raw.startsWith("sound-icon:")) continue;
      if (/^https?:\/\//i.test(raw)) {
        http.set(raw, true);
        continue;
      }
      if (/images\/?/i.test(raw)) {
        const path = raw.replace(/^\.?\/*/, "").replace(/^images\/?/i, "").trim();
        const basename = path.split("/").pop() || path;
        if (basename) relative.set(basename, true);
      }
    }
  }

  const out: MarkdownImagePrefetchTarget[] = [];
  orchestra.forEach((_, k) => out.push({ kind: "orchestra", key: k }));
  http.forEach((_, u) => out.push({ kind: "http", url: u }));
  relative.forEach((_, b) => out.push({ kind: "relative", basename: b }));
  return out;
}
