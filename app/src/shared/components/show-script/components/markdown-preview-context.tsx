import React, { createContext } from "react";
import type { MarkdownPreviewParagraphProps } from "./markdown-preview-types";

export const MarkdownKadrIdContext = createContext<string | null>(null);
export const MarkdownKadrLightColumnContext = createContext(false);
export const MarkdownKadrPictureColumnContext = createContext(false);
export const MarkdownKadrBodyContext = createContext(false);
export const MarkdownKadrSoundPlaybackContext = createContext<number | undefined>(undefined);
export const MarkdownPreviewParagraphBridgeContext =
  createContext<Omit<MarkdownPreviewParagraphProps, "children"> | null>(null);
export const MarkdownPreviewLightTokensBridgeContext =
  createContext<((children: React.ReactNode) => React.ReactNode) | null>(null);
