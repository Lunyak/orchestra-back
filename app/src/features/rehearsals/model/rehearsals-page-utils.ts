import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);
dayjs.locale("ru");

export function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

export function formatMemberLabel(m: { email: string; displayName?: string | null }): string {
  const name = String(m.displayName ?? "").trim();
  return name ? `${name} (${m.email})` : m.email;
}

export function extractRolesBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? "").trim();
    if (!role) continue;
    out.push(role);
  }
  return Array.from(new Set(out));
}

export function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("==") || line.startsWith("(")) continue;

    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, " ").trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }

    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) {
      out.push(m2[1].trim());
    }
  }
  return Array.from(new Set(out));
}

export function extractRolesSmart(text?: string): string[] {
  const a = extractRolesBrackets(text);
  const b = extractSpeakerRolesFromLines(text);
  return Array.from(new Set([...a, ...b]));
}

export function normalizeRoleName(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
