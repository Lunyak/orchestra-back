import React from "react";
import { decodeOrchestraImageStorageKey } from "../../../utils/markdownImages";
import { looksLikeOpaqueMediaId } from "./markdown-preview-normalize";
import {
  getLineLabelKind,
  isIgnorableLeadingNode,
  isLineLabelElement,
} from "./markdown-preview-node-utils";
import type { MarkdownKadrMediaLookup } from "./markdown-kadr-media-context";
import type {
  LineLabelKind,
  SoundLinkPayload,
  TrackLinkPayload,
} from "./markdown-preview-types";
export function getLeadingTrackPayload(children: React.ReactNode): TrackLinkPayload | null {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!React.isValidElement(candidate)) return null;
  const className = (candidate.props as any)?.className;
  const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
  if (!/\bmarkdown-track-link\b/.test(classStr)) return null;
  const rawId = (candidate.props as any)?.["data-track-id"];
  const rawName = (candidate.props as any)?.["data-track-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

export function getPlayPayloadFromLabelEl(labelEl: React.ReactElement): TrackLinkPayload | null {
  const rawId = (labelEl.props as any)?.["data-track-id"];
  const rawName = (labelEl.props as any)?.["data-track-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

export function getSoundPayloadFromLabelEl(labelEl: React.ReactElement): SoundLinkPayload | null {
  const rawId = (labelEl.props as any)?.["data-sound-id"];
  const rawName = (labelEl.props as any)?.["data-sound-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

export function getLeadingSoundPayload(children: React.ReactNode): SoundLinkPayload | null {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!React.isValidElement(candidate)) return null;
  const className = (candidate.props as any)?.className;
  const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
  if (!/\bmarkdown-sound-link\b/.test(classStr)) return null;
  const rawId = (candidate.props as any)?.["data-sound-id"];
  const rawName = (candidate.props as any)?.["data-sound-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

export function flattenInertSpans(nodes: React.ReactNode[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const n of nodes) {
    if (!React.isValidElement(n) || !n.props) {
      out.push(n);
      continue;
    }
    const props = n.props as Record<string, unknown>;
    const hasHostProps =
      props.className != null ||
      props.style != null ||
      props.title != null ||
      props.id != null ||
      props.role != null ||
      props["data-lk-id"] != null ||
      props["data-track-id"] != null ||
      props["data-sound-id"] != null ||
      props["data-video-id"] != null ||
      props["data-hold-id"] != null;
    const canUnwrap =
      !hasHostProps &&
      (n.type === "span" ||
        n.type === React.Fragment ||
        // custom react-markdown `span` — type не строка "span"
        typeof n.type === "function");
    if (canUnwrap) {
      out.push(...flattenInertSpans(React.Children.toArray(props.children as React.ReactNode)));
      continue;
    }
    out.push(n);
  }
  return out;
}

export function splitLeadingLineLabel(
  children: React.ReactNode,
): {
  label: React.ReactElement | null;
  rest: React.ReactNode[];
  kind: LineLabelKind | null;
} {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!isLineLabelElement(candidate)) {
    return { label: null, rest: flat, kind: null };
  }
  const rest = flat.slice(i + 1);
  return { label: candidate, rest, kind: getLineLabelKind(candidate) };
}

export function normalizeRoleToken(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

export function reactNodeHasRawLightPanelToken(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (typeof node === "string" || typeof node === "number") {
    return /\{\{\s*lightpanel\s*:/i.test(String(node));
  }
  if (Array.isArray(node)) return node.some(reactNodeHasRawLightPanelToken);
  if (React.isValidElement(node)) {
    return reactNodeHasRawLightPanelToken((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

export function reactNodePlainText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodePlainText).join("");
  if (React.isValidElement(node)) {
    return reactNodePlainText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function skipKadrMediaFieldPrefix(
  flat: React.ReactNode[],
  labels: string[],
  start = 0,
): number {
  let i = start;
  while (i < flat.length && isIgnorableLeadingNode(flat[i])) i += 1;
  if (i >= flat.length) return i;

  const n0 = flat[i];
  if (React.isValidElement(n0) && n0.type === "strong") {
    const token = normalizeRoleToken(reactNodePlainText(n0));
    if (labels.includes(token)) {
      const n1 = flat[i + 1];
      if (n1 == null) return i + 1;
      // Skip label + standalone colon only; keep ": текст…" in rest for trimLeadingFieldColon.
      if (typeof n1 === "string" && /^\s*:\s*$/.test(n1)) return i + 2;
      return i + 1;
    }
  }

  if (typeof n0 === "string") {
    const labelPattern = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const m = new RegExp(`^\\s*(?:\\*\\*)?(?:${labelPattern})(?:\\*\\*)?\\s*:\\s*`, "i").exec(n0);
    if (m) return i + 1;
  }

  return start;
}

function skipKadrSoundFieldPrefix(flat: React.ReactNode[], start = 0): number {
  return skipKadrMediaFieldPrefix(flat, ["звук"], start);
}

function skipKadrVideoFieldPrefix(flat: React.ReactNode[], start = 0): number {
  return skipKadrMediaFieldPrefix(flat, ["видео", "проектор"], start);
}

const KADR_TEXT_FIELD_LABELS: Record<string, string> = {
  "действие/задача": "Действие/задача",
  действие: "Действие",
  переход: "Переход",
};

function resolveKadrTextFieldLabel(flat: React.ReactNode[]): string {
  for (const node of flat) {
    if (React.isValidElement(node) && node.type === "strong") {
      const token = normalizeRoleToken(reactNodePlainText(node));
      if (KADR_TEXT_FIELD_LABELS[token]) return KADR_TEXT_FIELD_LABELS[token];
    }
    if (typeof node === "string") {
      const token = normalizeRoleToken(node);
      for (const key of Object.keys(KADR_TEXT_FIELD_LABELS)) {
        if (token.startsWith(key)) return KADR_TEXT_FIELD_LABELS[key]!;
      }
    }
  }
  return "";
}

export function splitKadrTextFieldLine(
  rendered: React.ReactNode,
): { label: string; rest: React.ReactNode[] } | null {
  const flat = flattenInertSpans(React.Children.toArray(rendered));
  const labels = Object.keys(KADR_TEXT_FIELD_LABELS);
  const afterPrefix = skipKadrMediaFieldPrefix(flat, labels);
  if (afterPrefix === 0) return null;
  const label = resolveKadrTextFieldLabel(flat);
  if (!label) return null;
  return { label, rest: trimLeadingFieldColon(flat.slice(afterPrefix)) };
}

function trimLeadingSoundMetaSeparator(nodes: React.ReactNode[]): React.ReactNode[] {
  if (nodes.length === 0) return nodes;
  const first = nodes[0];
  if (typeof first !== "string") return nodes;
  const trimmed = first.replace(/^\s*[·•]\s*/, "");
  if (!trimmed.trim()) return trimLeadingSoundMetaSeparator(nodes.slice(1));
  if (trimmed === first) return nodes;
  return [trimmed, ...nodes.slice(1)];
}

function trimLeadingFieldColon(nodes: React.ReactNode[]): React.ReactNode[] {
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    if (typeof n === "string") {
      const t = n.replace(/^\s*:\s*/, "");
      if (!t.trim()) {
        i += 1;
        continue;
      }
      if (t !== n) return [t, ...nodes.slice(i + 1)];
    }
    break;
  }
  return nodes.slice(i);
}

function reactElementClassStr(el: React.ReactElement): string {
  const className = (el.props as { className?: string }).className;
  return Array.isArray(className) ? className.join(" ") : String(className ?? "");
}

function isPlayLabelElement(node: unknown): boolean {
  if (!React.isValidElement(node)) return false;
  return /\bmarkdown-play-label\b/.test(reactElementClassStr(node));
}

function findKadrTrackLinkInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    if (/\bmarkdown-track-link\b/.test(reactElementClassStr(n))) return n;
  }
  return null;
}

function findKadrMediaChipInFlat(
  flat: React.ReactNode[],
  start = 0,
): { index: number; mediaKind: "play" | "sound" | "video"; mediaLabel: React.ReactElement } | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!isLineLabelElement(n)) continue;
    const kind = getLineLabelKind(n);
    if (kind === "play" || kind === "sound" || kind === "video") {
      return { index: i, mediaKind: kind, mediaLabel: n };
    }
  }
  return null;
}

function isKadrFieldNoiseNode(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") {
    const t = node.trim();
    if (!t) return true;
    if (/^\{\{[\s\S]*\}\}$/.test(t)) return true;
    if (/^orchestra-image:/i.test(t)) return true;
    if (looksLikeOpaqueMediaId(t)) return true;
    return false;
  }
  if (!React.isValidElement(node)) return false;
  const cls = reactElementClassStr(node);
  if (/\bmarkdown-hold-label\b/.test(cls)) return true;
  if (/\bmarkdown-kadr-hold-chip\b/.test(cls)) return true;
  if (/\bmarkdown-video-label\b/.test(cls)) return true;
  if (/\bmarkdown-hold-link\b/.test(cls)) return true;
  if (/\bmarkdown-video-link\b/.test(cls)) return true;
  if (isPlayLabelElement(node)) return true;
  if (node.type === "em") {
    const text = reactNodePlainText(node).toLowerCase().trim();
    if (/записать проектор|не записано|ролик на экран/.test(text)) return true;
    if (text === "заставка") return true;
  }
  if (node.type === "a") {
    const href = String((node.props as { href?: string }).href ?? "").trim();
    const linkText = reactNodePlainText(node).trim();
    if (/^hold:/i.test(href)) return true;
    if (/^orchestra-image:/i.test(href)) return true;
    if (looksLikeOpaqueMediaId(linkText)) return true;
  }
  return false;
}

function collectKadrFieldRestNodes(
  flat: React.ReactNode[],
  afterPrefix: number,
  chipIndex: number | null,
  primaryLink: React.ReactElement | null,
): React.ReactNode[] {
  const rest: React.ReactNode[] = [];
  for (let i = afterPrefix; i < flat.length; i++) {
    if (chipIndex != null && i === chipIndex) continue;
    if (primaryLink && flat[i] === primaryLink) continue;
    const node = flat[i]!;
    if (isKadrFieldNoiseNode(node)) continue;
    rest.push(node);
  }
  return trimLeadingFieldColon(trimLeadingSoundMetaSeparator(rest));
}

function extractKadrVideoTitleFromRest(rest: React.ReactNode[]): string {
  const flat = flattenInertSpans(rest);
  for (const node of flat) {
    if (!React.isValidElement(node)) continue;
    if (/\bmarkdown-video-link\b/.test(reactElementClassStr(node))) {
      const title = reactNodePlainText(node).trim();
      if (title && !looksLikeOpaqueMediaId(title)) return title;
    }
  }
  return "";
}

function parseHoldHrefId(href?: string): number | null {
  const trimmed = String(href ?? "").trim();
  if (!/^hold:/i.test(trimmed)) return null;
  const id = Math.trunc(Number(trimmed.replace(/^hold:/i, "").trim()) || 0);
  return id > 0 ? id : null;
}

function findKadrHoldLinkInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    const cls = reactElementClassStr(n);
    if (/\bmarkdown-hold-link\b/.test(cls)) return n;
    if (n.type === "a") {
      const href = (n.props as { href?: string }).href;
      if (parseHoldHrefId(href) != null) return n;
    }
  }
  return null;
}

function resolveKadrHoldIdFromMediaSignals(
  flat: React.ReactNode[],
  media: MarkdownKadrMediaLookup,
): number | null {
  for (const node of flattenInertSpans(flat)) {
    if (!React.isValidElement(node)) continue;
    const cls = reactElementClassStr(node);
    if (/\bmarkdown-hold-link\b/.test(cls)) {
      const id = parseNumericIdAttr(node, "data-hold-id");
      if (id != null) return id;
    }
    if (node.type === "a") {
      const href = (node.props as { href?: string }).href;
      const holdId = parseHoldHrefId(href);
      if (holdId != null) return holdId;
      const trimmedHref = String(href ?? "").trim();
      if (/^orchestra-image:/i.test(trimmedHref)) {
        const enc = trimmedHref.replace(/^orchestra-image:/i, "").trim();
        const key = decodeOrchestraImageStorageKey(enc);
        const hold = media.holdImages.find(
          (h) =>
            String(h.remoteKey ?? "").trim() === key ||
            String(h.remoteKey ?? "").trim() === enc,
        );
        if (hold) return Number(hold.id);
      }
    }
  }

  const plain = reactNodePlainText(flat);
  for (const hold of media.holdImages) {
    const key = String(hold.remoteKey ?? "").trim();
    if (key && plain.includes(key)) return Number(hold.id);
  }
  if (/\{\{\s*hold\s*(?::\s*(\d+))?\s*}}/i.test(plain)) {
    const m = /\{\{\s*hold\s*:\s*(\d+)\s*}}/i.exec(plain);
    if (m) {
      const id = Math.trunc(Number(m[1]) || 0);
      if (id > 0) return id;
    }
    return null;
  }
  return null;
}

function looksLikeKadrHoldFieldContent(flat: React.ReactNode[]): boolean {
  const plain = reactNodePlainText(flat).toLowerCase();
  if (/\bзаставка\b/.test(plain)) return true;
  if (/\{\{\s*hold\b/i.test(plain)) return true;
  return findKadrHoldLinkInFlat(flat, 0) != null;
}

function extractKadrHoldTitleFromRest(rest: React.ReactNode[]): string {
  const flat = flattenInertSpans(rest);
  for (const node of flat) {
    if (!React.isValidElement(node)) continue;
    if (/\bmarkdown-hold-link\b/.test(reactElementClassStr(node))) {
      const title = reactNodePlainText(node).trim();
      if (title && !looksLikeOpaqueMediaId(title)) return title;
    }
  }
  return "";
}

function parseNumericIdAttr(el: React.ReactElement, attr: string): number | null {
  const raw = (el.props as Record<string, unknown>)[attr];
  const id = Math.trunc(Number(raw) || 0);
  return id > 0 ? id : null;
}

export function resolveKadrVideoDisplayTitle(
  rest: React.ReactNode[],
  media: MarkdownKadrMediaLookup,
  ids: { videoId?: number | null; holdId?: number | null },
  mode: "video" | "hold",
): string {
  const fromVideoLink = extractKadrVideoTitleFromRest(rest);
  const fromHoldLink = extractKadrHoldTitleFromRest(rest);
  const fromLink = mode === "hold" ? fromHoldLink || fromVideoLink : fromVideoLink || fromHoldLink;
  if (fromLink) return fromLink;

  if (ids.videoId != null) {
    const video = media.videos.find((v) => Number(v.id) === ids.videoId);
    const title = String(video?.title ?? "").trim();
    if (title && !looksLikeOpaqueMediaId(title)) return title;
    return `Видео ${ids.videoId}`;
  }

  if (ids.holdId != null) {
    const hold = media.holdImages.find((h) => Number(h.id) === ids.holdId);
    const title = String(hold?.title ?? "").trim();
    if (title && !looksLikeOpaqueMediaId(title)) return title;
    return "Заставка";
  }

  return mode === "hold" ? "Заставка" : "Видео";
}

function hasKadrVideoFieldSignals(flat: React.ReactNode[]): boolean {
  if (skipKadrVideoFieldPrefix(flat, 0) > 0) return true;
  if (findKadrMediaChipInFlat(flat, 0)?.mediaKind === "video") return true;
  if (findKadrVideoLinkInFlat(flat, 0)) return true;
  if (findKadrHoldLinkInFlat(flat, 0)) return true;
  if (findKadrHoldChipInFlat(flat, 0)) return true;
  const head = reactNodePlainText(flat.slice(0, 6)).toLowerCase();
  return /(?:видео|проектор)\s*:/.test(head);
}

function findKadrHoldChipInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    const cls = reactElementClassStr(n);
    if (/\bmarkdown-kadr-hold-chip\b/.test(cls) || /\bmarkdown-hold-label\b/.test(cls)) {
      return n;
    }
  }
  return null;
}

export function splitKadrSoundFieldLine(
  rendered: React.ReactNode,
): {
  mediaKind: "play" | "sound";
  rest: React.ReactNode[];
} | null {
  const flat = flattenInertSpans(React.Children.toArray(rendered));
  const afterPrefix = skipKadrSoundFieldPrefix(flat, 0);
  if (afterPrefix === 0) return null;

  const chip = findKadrMediaChipInFlat(flat, afterPrefix);
  const trackLink = findKadrTrackLinkInFlat(flat, afterPrefix);

  if (chip && (chip.mediaKind === "play" || chip.mediaKind === "sound")) {
    return {
      mediaKind: chip.mediaKind,
      rest: collectKadrFieldRestNodes(flat, afterPrefix, chip.index, null),
    };
  }

  if (trackLink) {
    return {
      mediaKind: "play",
      rest: collectKadrFieldRestNodes(flat, afterPrefix, null, null),
    };
  }

  return null;
}

export function splitKadrVideoFieldLine(
  rendered: React.ReactNode,
  media: MarkdownKadrMediaLookup,
): {
  mediaKind: "video" | "hold";
  videoId: number | null;
  holdId: number | null;
  rest: React.ReactNode[];
} | null {
  const flat = flattenInertSpans(React.Children.toArray(rendered));
  if (!hasKadrVideoFieldSignals(flat)) return null;

  let afterPrefix = skipKadrVideoFieldPrefix(flat, 0);
  if (afterPrefix === 0) {
    const head = reactNodePlainText(flat.slice(0, 6)).toLowerCase();
    if (/(?:видео|проектор)\s*:/.test(head)) {
      afterPrefix = skipKadrMediaFieldPrefix(flat, ["видео", "проектор"], 0);
    }
  }
  const start = afterPrefix > 0 ? afterPrefix : 0;

  const chip = findKadrMediaChipInFlat(flat, start);
  if (chip?.mediaKind === "video") {
    return {
      mediaKind: "video",
      videoId: parseNumericIdAttr(chip.mediaLabel, "data-video-id"),
      holdId: null,
      rest: collectKadrFieldRestNodes(flat, start, chip.index, null),
    };
  }

  const holdChip = findKadrHoldChipInFlat(flat, start);
  if (holdChip) {
    return {
      mediaKind: "hold",
      videoId: null,
      holdId: parseNumericIdAttr(holdChip, "data-hold-id"),
      rest: collectKadrFieldRestNodes(flat, start, flat.indexOf(holdChip), null),
    };
  }

  const holdLink = findKadrHoldLinkInFlat(flat, start);
  if (holdLink) {
    const holdId =
      parseNumericIdAttr(holdLink, "data-hold-id") ??
      parseHoldHrefId((holdLink.props as { href?: string }).href);
    return {
      mediaKind: "hold",
      videoId: null,
      holdId,
      rest: collectKadrFieldRestNodes(flat, start, null, null),
    };
  }

  const videoLink = findKadrVideoLinkInFlat(flat, start);
  if (videoLink) {
    return {
      mediaKind: "video",
      videoId: parseNumericIdAttr(videoLink, "data-video-id"),
      holdId: null,
      rest: collectKadrFieldRestNodes(flat, start, null, null),
    };
  }

  const tail = flat.slice(start);
  if (looksLikeKadrHoldFieldContent(tail)) {
    const holdId = resolveKadrHoldIdFromMediaSignals(tail, media);
    return {
      mediaKind: "hold",
      videoId: null,
      holdId,
      rest: collectKadrFieldRestNodes(flat, start, null, null),
    };
  }

  return null;
}

function findKadrVideoLinkInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    if (/\bmarkdown-video-link\b/.test(reactElementClassStr(n))) return n;
  }
  return null;
}

