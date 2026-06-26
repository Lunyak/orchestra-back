import { markdownToPlainText } from "../../../shared/utils/textPreview";
import type { ScriptScene } from "../../../shared/types/script";
import { stripLeadingPunctuation } from "./wordTokens";

export type RolePhraseSource = {
  lineId: string;
  sceneId: number;
  sceneTitle: string;
  role: string;
  text: string;
};

function normalizeRole(v: string): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function normalizeRoleKey(v: string): string {
  return normalizeRole(v)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStageDirectionLine(line: string): boolean {
  const s = String(line ?? "").trim();
  if (!s) return true;
  if (s.startsWith("(")) return true;
  if (s.startsWith("==")) return true;
  if (s.startsWith(">")) return true;
  return false;
}

function cleanUtteranceText(raw: string): string {
  let s = String(raw ?? "");
  // remove light/script tokens like {{light:1}} or {{blackout}}
  s = s.replace(/\{\{[^}]*\}\}/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = markdownToPlainText(s);
  // Parentheses in this project are stage remarks the actor doesn't speak.
  s = s.replace(/\([^)]*\)/g, " ");
  return stripLeadingPunctuation(s.replace(/\s+/g, " ").trim());
}

function parseLineSpeaker(line: string): { role: string; rest: string } | null {
  const src = String(line ?? "");
  const trimmed = src.trim();
  if (!trimmed) return null;

  // [[ROLE]] text
  const mBracket = trimmed.match(/^\s*\[\[\s*([^\]]+?)\s*\]\]\s*(.*)$/);
  if (mBracket?.[1]) {
    return { role: normalizeRole(mBracket[1]), rest: String(mBracket[2] ?? "") };
  }

  // ROLE: text  /  ROLE — text  / ROLE - text
  const mPrefix = trimmed.match(
    /^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+(.+)$/
  );
  if (mPrefix?.[1]) {
    return { role: normalizeRole(mPrefix[1]), rest: String(mPrefix[2] ?? "") };
  }

  return null;
}

export function extractRolesFromText(text?: string): string[] {
  const s = String(text ?? "");
  if (!s.trim()) return [];
  const out: string[] = [];

  // [[ROLE]]
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const role = normalizeRole(m[1] ?? "");
    if (role) out.push(role);
  }

  // ROLE: text patterns
  s.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (isStageDirectionLine(line)) return;
    const parsed = parseLineSpeaker(line);
    if (parsed?.role) out.push(parsed.role);
  });

  return Array.from(new Set(out));
}

export function normalizeCastActors(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out = value.map((x) => String(x ?? "").trim()).filter(Boolean);
    return out.filter((v, i) => out.indexOf(v) === i);
  }
  const s = String(value ?? "").trim();
  return s ? [s] : [];
}

/**
 * Объединяет "истину" по ролям из:
 * - `playbookData.roleAssignments` (глобально)
 */
export function buildRoleAssignmentsIndex(opts: {
  scenes: ScriptScene[];
  roleAssignments?: Record<string, string[]>;
}): Map<string, { role: string; actors: string[] }> {
  const map = new Map<string, { role: string; actors: string[] }>();
  const push = (roleRaw: string, actorsRaw: string[]) => {
    const role = normalizeRole(roleRaw);
    const key = normalizeRoleKey(role);
    if (!key) return;
    const actors = (actorsRaw ?? [])
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    if (actors.length === 0) return;
    const prev = map.get(key);
    const nextActors = Array.from(
      new Set([...(prev?.actors ?? []), ...actors])
    );
    map.set(key, { role: prev?.role ?? role, actors: nextActors });
  };

  for (const [role, list] of Object.entries(opts.roleAssignments ?? {})) {
    if (!role) continue;
    push(role, Array.isArray(list) ? list : []);
  }

  return map;
}

export function extractRolePhrasesFromScenes(opts: {
  scenes: ScriptScene[];
  role: string;
  /** Дополнительные ключи роли (key/aliases), чтобы находить реплики при алиасах в тексте. */
  roleKeys?: string[];
  preferField?: "playMarkdown" | "markdown";
}): RolePhraseSource[] {
  const desiredKeys = Array.from(
    new Set(
      (opts.roleKeys && opts.roleKeys.length ? opts.roleKeys : [opts.role])
        .map((x) => normalizeRoleKey(String(x ?? "")))
        .filter(Boolean),
    ),
  );
  if (desiredKeys.length === 0) return [];
  const desiredSet = new Set(desiredKeys);

  const out: RolePhraseSource[] = [];

  for (const scene of opts.scenes ?? []) {
    // Важно: для актёрского тренажёра берём ТОЛЬКО "Текст" (playMarkdown),
    // без подмешивания "Схемы" (markdown), если явно не выбрано иначе.
    const rawText =
      (opts.preferField === "markdown"
        ? scene.markdown ?? ""
        : scene.playMarkdown ?? "") ?? "";
    const text = String(rawText ?? "");
    if (!text.trim()) continue;

    let currentRole: string | null = null;
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i] ?? "";
      const parsed = parseLineSpeaker(rawLine);
      const line = String(rawLine ?? "").trim();

      if (parsed) {
        currentRole = parsed.role;
        const rest = cleanUtteranceText(parsed.rest);
        if (!rest) continue;
        if (desiredSet.has(normalizeRoleKey(currentRole))) {
          out.push({
            lineId: `${scene.id}:u:${i}`,
            sceneId: scene.id,
            sceneTitle: scene.title ?? `Сцена ${scene.id}`,
            role: currentRole,
            text: rest,
          });
        }
        continue;
      }

      if (!currentRole) continue;
      if (isStageDirectionLine(line)) continue;
      const cleaned = cleanUtteranceText(line);
      if (!cleaned) continue;
      if (desiredSet.has(normalizeRoleKey(currentRole))) {
        out.push({
          lineId: `${scene.id}:u:${i}`,
          sceneId: scene.id,
          sceneTitle: scene.title ?? `Сцена ${scene.id}`,
          role: currentRole,
          text: cleaned,
        });
      }
    }
  }

  // uniq preserve order
  const seen = new Set<string>();
  const uniq: RolePhraseSource[] = [];
  for (const p of out) {
    const key = p.lineId;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(p);
  }
  return uniq;
}

