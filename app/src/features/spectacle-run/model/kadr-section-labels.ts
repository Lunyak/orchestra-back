import type { MarkdownKadrSection } from "../../theater/model/light-kadrs";

export type KadrRunLabelType = "blackout" | "smoke" | "smoke-machine";

export type KadrRunLabel = {
  type: KadrRunLabelType;
  /** Для blackout/smoke; у smoke-machine не используется. */
  seconds: number;
};

export const KADR_LABELS_LINE_PREFIX = "- **Метки**:";

const LABELS_KADR_LINE_RE = /^-\s*\*\*Метки\*\*:\s*([^\n]*)/im;
const TOKEN_BLACKOUT_SEC_RE = /\{\{\s*blackout-sec\s*:\s*(\d+)\s*}}/gi;
const TOKEN_SMOKE_SEC_RE = /\{\{\s*smoke-sec\s*:\s*(\d+)\s*}}/gi;
const TOKEN_SMOKE_MACHINE_RE = /\{\{\s*smoke-machine\s*}}/gi;

function parseSeconds(raw: string | undefined): number | null {
  const n = Math.trunc(Number(raw) || 0);
  return n > 0 ? n : null;
}

export function formatKadrRunLabelText(label: KadrRunLabel): string {
  if (label.type === "blackout") return `Блекаут ${label.seconds} с`;
  if (label.type === "smoke-machine") return "Дым-машина";
  return `Дым ${label.seconds} с`;
}

export function formatKadrLabelsLine(labels: KadrRunLabel[]): string {
  const parts: string[] = [];
  for (const label of labels) {
    if (label.type === "smoke-machine") {
      parts.push("{{smoke-machine}}");
      continue;
    }
    const sec = Math.max(1, Math.trunc(label.seconds) || 1);
    if (label.type === "blackout") parts.push(`{{blackout-sec:${sec}}}`);
    if (label.type === "smoke") parts.push(`{{smoke-sec:${sec}}}`);
  }
  if (parts.length === 0) return "";
  return `${KADR_LABELS_LINE_PREFIX} ${parts.join(" ")}`;
}

export function parseKadrLabelsFromBody(body: string): KadrRunLabel[] {
  const match = LABELS_KADR_LINE_RE.exec(String(body ?? ""));
  if (!match?.[1]) return [];

  const line = match[1];
  TOKEN_BLACKOUT_SEC_RE.lastIndex = 0;
  TOKEN_SMOKE_SEC_RE.lastIndex = 0;
  TOKEN_SMOKE_MACHINE_RE.lastIndex = 0;

  const labels: KadrRunLabel[] = [];

  const blackoutMatch = TOKEN_BLACKOUT_SEC_RE.exec(line);
  const blackoutSec = parseSeconds(blackoutMatch?.[1]);
  if (blackoutSec != null) labels.push({ type: "blackout", seconds: blackoutSec });

  const smokeMatch = TOKEN_SMOKE_SEC_RE.exec(line);
  const smokeSec = parseSeconds(smokeMatch?.[1]);
  if (smokeSec != null) labels.push({ type: "smoke", seconds: smokeSec });

  if (TOKEN_SMOKE_MACHINE_RE.test(line)) {
    labels.push({ type: "smoke-machine", seconds: 0 });
  }

  return labels;
}

export function parseKadrLabelsInSection(
  markdown: string,
  section: MarkdownKadrSection,
): KadrRunLabel[] {
  const body = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  return parseKadrLabelsFromBody(body);
}

export function upsertKadrLabelsInSection(
  markdown: string,
  section: MarkdownKadrSection,
  labels: KadrRunLabel[],
): string {
  const text = String(markdown ?? "");
  const slice = text.slice(section.headingEnd, section.sectionEnd);
  const line = formatKadrLabelsLine(labels);
  const lineMatch = slice.match(LABELS_KADR_LINE_RE);

  if (!line) {
    if (!lineMatch || lineMatch.index == null) return text;
    const absStart = section.headingEnd + lineMatch.index;
    let absEnd = absStart + lineMatch[0].length;
    if (text[absEnd] === "\n") absEnd += 1;
    return text.slice(0, absStart) + text.slice(absEnd);
  }

  if (lineMatch && lineMatch.index != null) {
    const absStart = section.headingEnd + lineMatch.index;
    const absEnd = absStart + lineMatch[0].length;
    return text.slice(0, absStart) + line + text.slice(absEnd);
  }

  const insertAt = section.sectionEnd;
  const prefix = text.slice(insertAt, insertAt + 1) === "\n" ? "" : "\n";
  return `${text.slice(0, insertAt)}${prefix}\n${line}\n${text.slice(insertAt)}`;
}

export function buildKadrRunLabelsFromDraft(args: {
  blackoutDurationSec: number | null;
  smokeDurationSec: number | null;
  smokeMachine?: boolean;
}): KadrRunLabel[] {
  const labels: KadrRunLabel[] = [];
  const blackoutSec = parseSeconds(
    args.blackoutDurationSec != null ? String(args.blackoutDurationSec) : undefined,
  );
  const smokeSec = parseSeconds(
    args.smokeDurationSec != null ? String(args.smokeDurationSec) : undefined,
  );
  if (blackoutSec != null) labels.push({ type: "blackout", seconds: blackoutSec });
  if (smokeSec != null) labels.push({ type: "smoke", seconds: smokeSec });
  if (args.smokeMachine) labels.push({ type: "smoke-machine", seconds: 0 });
  return labels;
}
