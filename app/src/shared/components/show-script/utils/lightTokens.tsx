import React from "react";

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
    blue: "#2563eb",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#f59e0b",
    white: "#f8fafc",
    black: "#0f172a",
    orange: "#f97316",
    purple: "#a855f7",
    pink: "#ec4899",
    cyan: "#22d3ee",
    magenta: "#d946ef",
    "синий": "#2563eb",
    "голубой": "#38bdf8",
    "красный": "#ef4444",
    "зеленый": "#22c55e",
    "желтый": "#f59e0b",
    "белый": "#f8fafc",
    "черный": "#0f172a",
    "оранжевый": "#f97316",
    "фиолетовый": "#a855f7",
    "розовый": "#ec4899",
  };
  return palette[raw] ?? null;
}

export function getReadableTextColor(color?: string | null): string | undefined {
  if (!color) return undefined;
  const hex = color.startsWith("#") ? color.slice(1) : "";
  if (hex.length !== 6) return undefined;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return undefined;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#f8fafc";
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

export function createRenderLightTokens(lightChannels: string[]) {
  return function renderLightTokens(
    node: React.ReactNode,
    keyPrefix = "light",
  ): React.ReactNode {
    if (typeof node === "string") {
      const pattern =
        /(\{\{\s*(light|b|play|sound|sfx)\s*(?::\s*([^}|]+?))?\s*(?:\|\s*([^}]+?))?\s*}})|(\[\[\s*([^\]]+?)\s*]])/gi;
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let counter = 0;
      while ((match = pattern.exec(node)) !== null) {
        const [raw, , rawType, rawIndex, rawColor, , rawLabel] = match;
        const start = match.index;
        if (start > lastIndex) {
          result.push(node.slice(lastIndex, start));
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
        } else if (rawType?.toLowerCase() === "b") {
          const label = "ЗТМ";
          const color = resolveLightColor(label, "#000000", rawColor) ?? "#000000";
          result.push(renderLightChip(label, color, `${keyPrefix}-${counter}-b`));
        } else {
          const index = Number(String(rawIndex ?? ""));
          if (Number.isFinite(index) && index >= 1 && index <= 8) {
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
        result.push(node.slice(lastIndex));
      }
      return result;
    }
    if (Array.isArray(node)) {
      return node.flatMap((child, index) => renderLightTokens(child, `${keyPrefix}-${index}`));
    }
    if (React.isValidElement(node)) {
      if (node.type === "code" || node.type === "pre") return node;
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

export function createRehypeScriptTokens(lightChannels: string[]) {
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
      /(\{\{\s*(light|blackout|play|sound|sfx)\s*(?::\s*([^}|]+?))?\s*(?:\|\s*([^}]+?))?\s*}})|(\[\[\s*([^\]]+?)\s*]])/gi;

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
          } else if (rawType?.toLowerCase() === "blackout") {
            const label = "Блекаут";
            const color = resolveLightColor(label, "#000000", rawColor) ?? "#000000";
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
            const index = Number(String(rawIndex ?? ""));
            if (Number.isFinite(index) && index >= 1 && index <= 8) {
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

