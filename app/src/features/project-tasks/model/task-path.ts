import { projectTaskPath } from "../../../app/router/paths";

const CYRILLIC_TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function slugifyTaskTitle(title: string): string {
  const transliterated = Array.from(title.trim().toLowerCase().normalize("NFKD"))
    .map((char) => {
      if (CYRILLIC_TRANSLIT[char] != null) return CYRILLIC_TRANSLIT[char];
      if (/[a-z0-9]/.test(char)) return char;
      return "-";
    })
    .join("");

  return transliterated
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Canonical project task URL; id is cuid (no dashes). */
export function buildTaskPath(
  projectSlug: string,
  taskId: string,
  title?: string | null,
): string {
  const id = taskId.trim();
  if (!id) return projectTaskPath(projectSlug);
  const slug = title ? slugifyTaskTitle(title) : "";
  if (!slug) return projectTaskPath(projectSlug, id);
  return projectTaskPath(projectSlug, `${id}-${slug}`);
}

export function parseTaskPathParam(param: string): string {
  const raw = decodeURIComponent(String(param ?? "").trim());
  if (!raw) return "";
  const dashIndex = raw.indexOf("-");
  if (dashIndex <= 0) return raw;
  return raw.slice(0, dashIndex);
}
