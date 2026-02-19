import type { ScriptStep } from "../../../shared/types/script";
import { markdownToPlainText } from "../../../shared/utils/textPreview";

export type DialogueLine = {
  id: string;
  stepId: number;
  stepTitle: string;
  kind: "utterance" | "stage";
  role?: string;
  text: string;
};

function normalizeRole(v: string): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeRoleKey(v: string): string {
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
  // common markdown list markers -> treat as stage/note
  if (/^(\*|-|\d+\.)\s+/.test(s)) return true;
  return false;
}

function cleanText(raw: string): string {
  let s = String(raw ?? "");
  // remove light/script tokens like {{light:1}} or {{blackout}}
  s = s.replace(/\{\{[^}]*\}\}/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = markdownToPlainText(s);
  return s.replace(/\s+/g, " ").trim();
}

function parseLineSpeaker(line: string): { role: string; rest: string } | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return null;

  // [[ROLE]] text
  const mBracket = trimmed.match(/^\s*\[\[\s*([^\]]+?)\s*\]\]\s*(.*)$/);
  if (mBracket?.[1]) {
    return { role: normalizeRole(mBracket[1]), rest: String(mBracket[2] ?? "") };
  }

  // ROLE: text  /  ROLE — text  / ROLE - text
  const mPrefix = trimmed.match(
    /^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+(.+)$/,
  );
  if (mPrefix?.[1]) {
    return { role: normalizeRole(mPrefix[1]), rest: String(mPrefix[2] ?? "") };
  }

  return null;
}

export function buildDialogueLines(opts: {
  steps: ScriptStep[];
  preferField?: "playMarkdown" | "markdown";
}): DialogueLine[] {
  const out: DialogueLine[] = [];

  for (const step of opts.steps ?? []) {
    const rawText =
      (opts.preferField === "markdown"
        ? step.markdown ?? ""
        : step.playMarkdown ?? step.markdown ?? "") ?? "";
    const text = String(rawText ?? "");
    if (!text.trim()) continue;

    let currentRole: string | null = null;
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i] ?? "";
      const trimmed = String(rawLine).trim();
      if (!trimmed) continue;

      const parsed = parseLineSpeaker(trimmed);
      if (parsed) {
        currentRole = parsed.role;
        const rest = cleanText(parsed.rest);
        if (!rest) continue;
        out.push({
          id: `${step.id}:u:${i}`,
          stepId: step.id,
          stepTitle: step.title ?? `Шаг ${step.id}`,
          kind: "utterance",
          role: currentRole,
          text: rest,
        });
        continue;
      }

      if (isStageDirectionLine(trimmed)) {
        const st = cleanText(trimmed);
        if (!st) continue;
        out.push({
          id: `${step.id}:s:${i}`,
          stepId: step.id,
          stepTitle: step.title ?? `Шаг ${step.id}`,
          kind: "stage",
          text: st,
        });
        continue;
      }

      // continuation line: belongs to last speaker if any, otherwise stage/note
      const cleaned = cleanText(trimmed);
      if (!cleaned) continue;
      if (currentRole) {
        out.push({
          id: `${step.id}:u:${i}`,
          stepId: step.id,
          stepTitle: step.title ?? `Шаг ${step.id}`,
          kind: "utterance",
          role: currentRole,
          text: cleaned,
        });
      } else {
        out.push({
          id: `${step.id}:s:${i}`,
          stepId: step.id,
          stepTitle: step.title ?? `Шаг ${step.id}`,
          kind: "stage",
          text: cleaned,
        });
      }
    }
  }

  return out;
}

