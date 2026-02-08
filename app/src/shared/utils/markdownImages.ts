import type { ScriptStep } from "../types/script";

/**
 * Картинки в маркдауне: при сохранении сцены оставляем в images только те, на которые есть ссылки.
 * Неиспользуемые ключи убираются из payload → при пуше бэкенд удаляет их из MinIO (sync.service).
 * Так хранилище не засоряется.
 */

/** Собирает имена файлов картинок, на которые есть ссылки в маркдауне шагов (![alt](path) с path вида ./images/xxx или images/xxx). */
export function getReferencedImageFilenames(steps: ScriptStep[]): Set<string> {
  const names = new Set<string>();
  // Ссылки на картинки: ![alt](url) — учитываем только относительные пути к images/
  const re = /!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/g;
  for (const step of steps) {
    const text = [step.markdown, step.playMarkdown].filter(Boolean).join("\n");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].trim();
      if (raw.startsWith("data:") || raw.startsWith("http")) continue;
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

/** Оставляет в images только те картинки, которые реально упоминаются в шагах. Остальные можно удалить с хранилища при пуше. */
export function pruneSceneImages(
  images: SceneImagesMap | undefined | null,
  steps: ScriptStep[],
): SceneImagesMap | undefined {
  if (!images || typeof images !== "object") return undefined;
  const referenced = getReferencedImageFilenames(steps);
  const pruned: SceneImagesMap = {};
  for (const name of referenced) {
    if (images[name]) pruned[name] = images[name];
  }
  return Object.keys(pruned).length > 0 ? pruned : undefined;
}
