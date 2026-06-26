import React from "react";
import { LINE_LABEL_CLASSNAMES } from "./markdown-preview-normalize";
import type { LineLabelKind } from "./markdown-preview-types";
export function isIgnorableLeadingNode(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") {
    // Treat NBSP / ZWSP as whitespace too
    return /^[\s\u00A0\u200B\u200C\u200D\uFEFF]*$/.test(node);
  }
  if (React.isValidElement(node)) {
    return node.type === "br";
  }
  return false;
}

export function isLineLabelElement(node: unknown): node is React.ReactElement {
  if (!React.isValidElement(node)) return false;
  const className = (node.props as any)?.className;
  if (typeof className === "string") {
    for (const part of className.split(/\s+/)) {
      if (LINE_LABEL_CLASSNAMES.has(part)) return true;
    }
    return false;
  }
  if (Array.isArray(className)) return className.some((c) => LINE_LABEL_CLASSNAMES.has(String(c)));
  return false;
}

export function getLineLabelKind(el: React.ReactElement): LineLabelKind | null {
  const className = (el.props as any)?.className;
  const parts =
    typeof className === "string"
      ? className.split(/\s+/)
      : Array.isArray(className)
        ? className.map((c) => String(c))
        : [];
  if (parts.includes("markdown-speaker-label")) return "role";
  if (parts.includes("markdown-light-chip")) return "light";
  if (parts.includes("markdown-play-label")) return "play";
  if (parts.includes("markdown-sound-label")) return "sound";
  if (parts.includes("markdown-video-label")) return "video";
  return null;
}

