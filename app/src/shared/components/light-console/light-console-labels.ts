/** Короткие подписи: K — канал, F — фейдер, P — программа. */

export function formatChannelShort(slot: number): string {
  return `K${Math.max(1, Math.trunc(slot))}`;
}

export function formatFaderShort(id: number): string {
  return `F${Math.max(1, Math.trunc(id))}`;
}

/** Старые автоподписи из сцены («Фейдер 3», «ф 1») — не считаем своим именем. */
const LEGACY_AUTO_FADER_LABEL_RE =
  /^(?:фейдер|fader|ф|f)\s*#?\s*(\d+)\s*$/iu;

export function isLegacyAutoFaderLabel(label: string | null | undefined): boolean {
  const trimmed = String(label ?? "").trim();
  if (!trimmed) return true;
  return LEGACY_AUTO_FADER_LABEL_RE.test(trimmed);
}

export function formatProgramShort(id: number): string {
  return `P${Math.max(1, Math.trunc(id))}`;
}

export function formatFaderDefaultLabel(id: number, custom?: string | null): string {
  const trimmed = String(custom ?? "").trim();
  if (!trimmed || isLegacyAutoFaderLabel(trimmed)) {
    return formatFaderShort(id);
  }
  return trimmed;
}

export function formatProgramDefaultLabel(id: number, custom?: string | null): string {
  const trimmed = String(custom ?? "").trim();
  return trimmed || `Программа ${formatProgramShort(id)}`;
}

export function formatChannelDefaultLabel(slot: number, custom?: string | null): string {
  const trimmed = String(custom ?? "").trim();
  return trimmed || formatChannelShort(slot);
}

const FADER_PIPE_TRAILING_PCT_RE = /(\d+(?:\.\d+)?)\s*%?\s*$/;

function intensityFromPercentToken(raw: string): number | undefined {
  const text = String(raw ?? "").trim().replace(/,/g, ".");
  if (!text) return undefined;
  const m = text.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

/** K и F из хвоста токена, напр. `K3 F1 72%`. */
export function parseChannelFaderFromTokenPipe(
  pipe: string | undefined,
  faderId: number,
): { channel?: number; faderId: number } {
  const id = Math.max(1, Math.trunc(faderId));
  const raw = String(pipe ?? "").trim();
  const kf = raw.match(/^K\s*(\d+)\s+F\s*(\d+)/i);
  if (kf) {
    const channel = Math.trunc(Number(kf[1]));
    const fid = Math.trunc(Number(kf[2]));
    if (channel > 0 && fid > 0) return { channel, faderId: fid };
  }
  const kOnly = raw.match(/^K\s*(\d+)\b/i);
  if (kOnly) {
    const channel = Math.trunc(Number(kOnly[1]));
    if (channel > 0) return { channel, faderId: id };
  }
  return { faderId: id };
}

/** Разбор `{{fader:3|72%}}` или устаревшего `{{fader:3|F3 72%}}`. */
export function parseFaderTokenPipe(
  pipe: string | undefined,
  faderId: number,
): { label: string; pctLabel: string; intensity: number } {
  const id = Math.max(1, Math.trunc(faderId));
  const raw = String(pipe ?? "").trim();
  if (!raw) {
    return { label: formatFaderShort(id), pctLabel: "100%", intensity: 1 };
  }

  const trailing = raw.match(FADER_PIPE_TRAILING_PCT_RE);
  if (!trailing || trailing.index == null) {
    const onlyPct = intensityFromPercentToken(raw);
    if (onlyPct != null) {
      return {
        label: formatFaderShort(id),
        pctLabel: `${Math.round(onlyPct * 100)}%`,
        intensity: onlyPct,
      };
    }
    return {
      label: formatFaderDefaultLabel(id, raw),
      pctLabel: "100%",
      intensity: 1,
    };
  }

  const n = Number(trailing[1]);
  const pctRounded = Math.round(n > 1 ? n : n * 100);
  const pctLabel = `${pctRounded}%`;
  const intensity = Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
  const namePart = raw.slice(0, trailing.index).trim();
  const label =
    namePart && !isLegacyAutoFaderLabel(namePart)
      ? formatFaderDefaultLabel(id, namePart)
      : formatFaderShort(id);

  return { label, pctLabel, intensity };
}

/** Подпись чипа в тех. карте: `F1 72%` (без дубля «ф.1 F1 72%»). */
export function formatFaderChipDisplay(faderId: number, pipe?: string): string {
  const { label, pctLabel } = parseFaderTokenPipe(pipe, faderId);
  return `${label} ${pctLabel}`;
}
