import React from "react";
import { formatFaderChipDisplay } from "../../light-console/light-console-labels";
import { themeColorToHex } from "../../../styles/theme-color";

export type HastNode =
  | { type: "root"; children?: HastNode[] }
  | { type: "element"; tagName: string; properties?: any; children?: HastNode[] }
  | { type: "text"; value: string }
  | { type: string; [k: string]: any };

export function parseLightChannel(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { label: "", color: null as string | null };
  }
  const [labelPart, colorPart] = trimmed.split("|", 2);
  return {
    label: labelPart?.trim() ?? "",
    color: colorPart?.trim() ?? null,
  };
}

/** Текст `markdown-speaker-label`: первая буква заглавная, остальные строчные. */
export function formatSpeakerLabelDisplay(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "…";
  return t.charAt(0).toLocaleUpperCase("ru-RU") + t.slice(1).toLocaleLowerCase("ru-RU");
}

export function resolveLightColor(
  label: string,
  channelColor?: string | null,
  override?: string,
): string | null {
  const raw = (override ?? channelColor ?? label).trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("hsl")) {
    return raw;
  }
  const palette: Record<string, string> = {
    blue: "var(--color-primary)",
    red: "var(--color-error)",
    green: "var(--color-success-accent)",
    yellow: "var(--color-light-yellow)",
    white: "var(--color-text-bright)",
    black: "var(--color-surface-1)",
    orange: "var(--color-light-orange)",
    purple: "var(--color-light-purple)",
    pink: "var(--color-light-pink)",
    cyan: "var(--color-light-cyan)",
    magenta: "var(--color-light-magenta)",
    "синий": "var(--color-primary)",
    "голубой": "var(--color-light-sky)",
    "красный": "var(--color-error)",
    "зеленый": "var(--color-success-accent)",
    "желтый": "var(--color-light-yellow)",
    "белый": "var(--color-text-bright)",
    "черный": "var(--color-surface-1)",
    "оранжевый": "var(--color-light-orange)",
    "фиолетовый": "var(--color-light-purple)",
    "розовый": "var(--color-light-pink)",
  };
  return palette[raw] ?? null;
}

export function getReadableTextColor(color?: string | null): string | undefined {
  if (!color) return undefined;
  const hex = themeColorToHex(color);
  if (!hex) return undefined;
  const raw = hex.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return undefined;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "var(--color-surface-1)" : "var(--color-text-bright)";
}

export function isColorOverrideToken(raw?: string | null): boolean {
  const v = String(raw ?? "").trim();
  if (!v) return false;
  // If it resolves to any known color, treat it as a color override.
  return resolveLightColor("x", null, v) != null;
}

function renderLightChip(label: string, color: string | null, key: string) {
  const textColor = getReadableTextColor(color);
  return (
    <span
      key={key}
      className="markdown-light-chip"
      style={{
        backgroundColor: color || undefined,
        color: textColor || undefined,
        borderColor: color ? "transparent" : undefined,
      }}
    >
      {label}
    </span>
  );
}

function renderParentheticalRemarks(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /\([^()\n]+\)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    if (start > lastIndex) {
      result.push(text.slice(lastIndex, start));
    }
    result.push(
      <em key={`${keyPrefix}-remark-${counter}`} className="markdown-parenthetical-remark">
        {raw}
      </em>,
    );
    counter += 1;
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export type LightTokenRenderOptions = {
  renderLightPanel?: (kadrId: string) => React.ReactNode;
};

export function createRenderLightTokens(
  lightChannels: string[],
  options?: LightTokenRenderOptions,
) {
  return function renderLightTokens(
    node: React.ReactNode,
    keyPrefix = "light",
  ): React.ReactNode {
    if (typeof node === "string") {
      const pattern =
        /(\{\{\s*(light|b|blackout|program|fader|lightpanel|play|sound|sfx|video|hold)\s*(?::\s*([^}|]+?))?\s*(?:\|\s*([^}]+?))?\s*}})|(\[\[\s*([^\]]+?)\s*]])/gi;
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let counter = 0;
      while ((match = pattern.exec(node)) !== null) {
        const [raw, , rawType, rawIndex, rawColor, , rawLabel] = match;
        const start = match.index;
        if (start > lastIndex) {
          result.push(...renderParentheticalRemarks(node.slice(lastIndex, start), `${keyPrefix}-${counter}-pre`));
        }
        if (rawLabel != null) {
          const normalized = String(rawLabel).trim();
          const text = formatSpeakerLabelDisplay(normalized);
          result.push(
            <span
              key={`${keyPrefix}-${counter}-lbl`}
              className="markdown-speaker-label"
              title={normalized}
            >
              {text}
            </span>,
          );
        } else if (rawType?.toLowerCase() === "play") {
          const payload = String(rawIndex ?? "").trim();
          const labelText = String(rawColor ?? "").trim() || "Play";
          const id = Number(payload);
          result.push(
            <span
              key={`${keyPrefix}-${counter}-play`}
              className="markdown-play-label"
              role="button"
              tabIndex={0}
              title="Воспроизвести"
              data-track-id={Number.isFinite(id) ? String(id) : undefined}
              data-track-name={!Number.isFinite(id) ? payload : undefined}
            >
              {labelText}
            </span>,
          );
        } else if (rawType?.toLowerCase() === "sound" || rawType?.toLowerCase() === "sfx") {
          const payload = String(rawIndex ?? "").trim();
          const labelText = String(rawColor ?? "").trim() || "SFX";
          const id = Number(payload);
          result.push(
            <span
              key={`${keyPrefix}-${counter}-sound`}
              className="markdown-sound-label"
              role="button"
              tabIndex={0}
              title="Звук: воспроизвести/остановить"
              data-sound-id={Number.isFinite(id) ? String(id) : undefined}
              data-sound-name={!Number.isFinite(id) ? payload : undefined}
            >
              {labelText}
            </span>,
          );
        } else if (rawType?.toLowerCase() === "video") {
          const payload = String(rawIndex ?? "").trim();
          const labelText = String(rawColor ?? "").trim() || "Play";
          const id = Number(payload);
          result.push(
            <span
              key={`${keyPrefix}-${counter}-video`}
              className="markdown-video-label"
              role="button"
              tabIndex={0}
              title="Видео на проекторе"
              data-video-id={Number.isFinite(id) ? String(id) : undefined}
            >
              {labelText}
            </span>,
          );
        } else if (rawType?.toLowerCase() === "hold") {
          const holdId = Math.trunc(Number(String(rawIndex ?? "").trim()) || 0);
          result.push(
            <span
              key={`${keyPrefix}-${counter}-hold`}
              className="markdown-kadr-hold-chip"
              role="button"
              tabIndex={0}
              title="Показать заставку на проекторе"
              data-hold-id={holdId > 0 ? String(holdId) : undefined}
            >
              HOLD
            </span>,
          );
        } else if (rawType?.toLowerCase() === "b" || rawType?.toLowerCase() === "blackout") {
          const label = rawType?.toLowerCase() === "blackout" ? "Блекаут" : "ЗТМ";
          const color = resolveLightColor(label, "var(--color-text-black)000", rawColor) ?? "var(--color-text-black)000";
          result.push(renderLightChip(label, color, `${keyPrefix}-${counter}-b`));
        } else if (rawType?.toLowerCase() === "program") {
          const programId = Math.max(1, Math.trunc(Number(String(rawIndex ?? "")) || 1));
          const labelOverride = String(rawColor ?? "").trim();
          const channelValue = lightChannels[programId - 1] ?? "";
          const parsed = parseLightChannel(channelValue);
          const label = labelOverride || parsed.label || `П${programId}`;
          const color = resolveLightColor(label, parsed.color) ?? "var(--color-active-ascent)";
          result.push(renderLightChip(label, color, `${keyPrefix}-${counter}-program-${programId}`));
        } else if (rawType?.toLowerCase() === "fader") {
          const faderId = Math.max(1, Math.trunc(Number(String(rawIndex ?? "")) || 1));
          const label = formatFaderChipDisplay(faderId, rawColor);
          result.push(renderLightChip(label, "var(--color-surface-3)", `${keyPrefix}-${counter}-fader-${faderId}`));
        } else if (rawType?.toLowerCase() === "lightpanel") {
          const kadrId = String(rawIndex ?? "").trim();
          const panel = kadrId && options?.renderLightPanel ? options.renderLightPanel(kadrId) : null;
          result.push(
            <span key={`${keyPrefix}-${counter}-lightpanel`} className="markdown-light-split-host">
              {panel ?? "пульт"}
            </span>,
          );
        } else {
          const index = Number(String(rawIndex ?? ""));
          if (Number.isFinite(index) && index >= 1 && index <= lightChannels.length) {
            const channelValue = lightChannels[index - 1] ?? "";
            const parsed = parseLightChannel(channelValue);
            const overrideRaw = String(rawColor ?? "").trim();
            const labelOverride = overrideRaw && !isColorOverrideToken(overrideRaw) ? overrideRaw : "";
            const colorOverride = overrideRaw && isColorOverrideToken(overrideRaw) ? overrideRaw : "";

            const label = labelOverride || (parsed.label ? parsed.label : String(index));
            const color = resolveLightColor(label, parsed.color, colorOverride || undefined);
            result.push(renderLightChip(label, color, `${keyPrefix}-${counter}-${index}`));
          } else {
            result.push(raw);
          }
        }
        counter += 1;
        lastIndex = start + raw.length;
      }
      if (lastIndex < node.length) {
        result.push(...renderParentheticalRemarks(node.slice(lastIndex), `${keyPrefix}-${counter}-tail`));
      }
      return result;
    }
    if (Array.isArray(node)) {
      return node.flatMap((child, index) => renderLightTokens(child, `${keyPrefix}-${index}`));
    }
    if (React.isValidElement(node)) {
      if (node.type === "code" || node.type === "pre") return node;
      if (node.type === "em") return node;
      if (node.props?.children == null) return node;
      return React.cloneElement(
        node,
        node.props,
        renderLightTokens(node.props.children, `${keyPrefix}-child`),
      );
    }
    return node;
  };
}

export function createRehypeScriptTokens(
  lightChannels: string[],
  options?: LightTokenRenderOptions,
) {
  return () => {
    const hastText = (value: string): HastNode => ({ type: "text", value } as HastNode);

    const hastSpan = (
      className: string[],
      children: HastNode[],
      properties?: Record<string, any>,
    ): HastNode =>
      ({
        type: "element",
        tagName: "span",
        properties: { className, ...(properties ?? {}) },
        children,
      }) as HastNode;

    const pattern =
      /(\{\{\s*(light|blackout|program|fader|lightpanel|play|sound|sfx|video|hold)\s*(?::\s*([^}|]+?))?\s*(?:\|\s*([^}]+?))?\s*}})|(\[\[\s*([^\]]+?)\s*]])/gi;

    const walk = (node: HastNode): HastNode => {
      if (!node) return node;
      if (node.type === "text") {
        const value = String((node as any).value ?? "");
        if (!value) return node;

        const out: HastNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(value)) !== null) {
          const [raw, , rawType, rawIndex, rawColor, , rawLabel] = match;
          const start = match.index;
          if (start > lastIndex) out.push(hastText(value.slice(lastIndex, start)));

          if (rawLabel != null) {
            const normalized = String(rawLabel).trim();
            const text = formatSpeakerLabelDisplay(normalized);
            out.push(
              hastSpan(["markdown-speaker-label"], [hastText(text)], { title: normalized }),
            );
          } else if (rawType?.toLowerCase() === "play") {
            const payload = String(rawIndex ?? "").trim();
            const labelText = String(rawColor ?? "").trim() || "Play";
            const id = Number(payload);
            out.push(
              hastSpan(["markdown-play-label"], [hastText(labelText)], {
                role: "button",
                tabIndex: 0,
                title: "Воспроизвести",
                "data-track-id": Number.isFinite(id) ? String(id) : undefined,
                "data-track-name": !Number.isFinite(id) ? payload : undefined,
              }),
            );
          } else if (rawType?.toLowerCase() === "sound" || rawType?.toLowerCase() === "sfx") {
            const payload = String(rawIndex ?? "").trim();
            const labelText = String(rawColor ?? "").trim() || "SFX";
            const id = Number(payload);
            out.push(
              hastSpan(["markdown-sound-label"], [hastText(labelText)], {
                role: "button",
                tabIndex: 0,
                title: "Звук: воспроизвести/остановить",
                "data-sound-id": Number.isFinite(id) ? String(id) : undefined,
                "data-sound-name": !Number.isFinite(id) ? payload : undefined,
              }),
            );
          } else if (rawType?.toLowerCase() === "video") {
            const payload = String(rawIndex ?? "").trim();
            const labelText = String(rawColor ?? "").trim() || "Play";
            const id = Number(payload);
            out.push(
              hastSpan(["markdown-video-label"], [hastText(labelText)], {
                role: "button",
                tabIndex: 0,
                title: "Видео на проекторе",
                "data-video-id": Number.isFinite(id) ? String(id) : undefined,
              }),
            );
          } else if (rawType?.toLowerCase() === "hold") {
            const holdId = Math.trunc(Number(String(rawIndex ?? "").trim()) || 0);
            out.push(
              hastSpan(["markdown-kadr-hold-chip"], [hastText("HOLD")], {
                role: "button",
                tabIndex: 0,
                title: "Показать заставку на проекторе",
                "data-hold-id": holdId > 0 ? String(holdId) : undefined,
              }),
            );
          } else if (rawType?.toLowerCase() === "blackout") {
            const label = "Блекаут";
            const color = resolveLightColor(label, "var(--color-text-black)000", rawColor) ?? "var(--color-text-black)000";
            const textColor = getReadableTextColor(color);
            out.push(
              hastSpan(["markdown-light-chip"], [hastText(label)], {
                style: {
                  backgroundColor: color || undefined,
                  color: textColor || undefined,
                  borderColor: color ? "transparent" : undefined,
                },
              }),
            );
          } else if (rawType?.toLowerCase() === "program") {
            const programId = Math.max(1, Math.trunc(Number(String(rawIndex ?? "")) || 1));
            const labelOverride = String(rawColor ?? "").trim();
            const channelValue = lightChannels[programId - 1] ?? "";
            const parsed = parseLightChannel(channelValue);
            const label = labelOverride || parsed.label || `П${programId}`;
            const color = resolveLightColor(label, parsed.color) ?? "var(--color-active-ascent)";
            const textColor = getReadableTextColor(color);
            out.push(
              hastSpan(["markdown-light-chip"], [hastText(label)], {
                style: {
                  backgroundColor: color || undefined,
                  color: textColor || undefined,
                  borderColor: color ? "transparent" : undefined,
                },
              }),
            );
          } else if (rawType?.toLowerCase() === "fader") {
            const faderId = Math.max(1, Math.trunc(Number(String(rawIndex ?? "")) || 1));
            const label = formatFaderChipDisplay(faderId, rawColor);
            out.push(hastSpan(["markdown-light-chip", "markdown-light-chip--fader"], [hastText(label)]));
          } else if (rawType?.toLowerCase() === "lightpanel") {
            const kadrId = String(rawIndex ?? "").trim();
            out.push(
              hastSpan(["markdown-light-split-host"], [hastText("")], {
                "data-lk-id": kadrId || undefined,
              }),
            );
          } else {
            const index = Number(String(rawIndex ?? ""));
            if (Number.isFinite(index) && index >= 1 && index <= lightChannels.length) {
              const channelValue = lightChannels[index - 1] ?? "";
              const parsed = parseLightChannel(channelValue);
              const overrideRaw = String(rawColor ?? "").trim();
              const labelOverride = overrideRaw && !isColorOverrideToken(overrideRaw) ? overrideRaw : "";
              const colorOverride = overrideRaw && isColorOverrideToken(overrideRaw) ? overrideRaw : "";

              const label = labelOverride || (parsed.label ? parsed.label : String(index));
              const color = resolveLightColor(label, parsed.color, colorOverride || undefined);
              const textColor = getReadableTextColor(color);
              out.push(
                hastSpan(["markdown-light-chip"], [hastText(label)], {
                  style: {
                    backgroundColor: color || undefined,
                    color: textColor || undefined,
                    borderColor: color ? "transparent" : undefined,
                  },
                }),
              );
            } else {
              out.push(hastText(raw));
            }
          }

          lastIndex = start + raw.length;
        }
        if (lastIndex < value.length) out.push(hastText(value.slice(lastIndex)));
        if (out.length === 0) return node;
        if (out.length === 1) return out[0];
        return { type: "element", tagName: "span", properties: {}, children: out } as HastNode;
      }

      if (node.type === "element") {
        const tag = String((node as any).tagName ?? "");
        if (tag === "code" || tag === "pre") return node;
      }

      const children = (node as any).children;
      if (Array.isArray(children)) {
        const nextChildren: HastNode[] = [];
        for (const child of children) {
          nextChildren.push(walk(child));
        }
        (node as any).children = nextChildren;
      }
      return node;
    };

    return (tree: HastNode) => {
      walk(tree);
    };
  };
}

