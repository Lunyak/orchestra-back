import type React from "react";
import type { PlaylistPlayOptions } from "../../../../features/playbook/model/playbook-playback-bridge";

export type LineLabelKind = "role" | "light" | "play" | "sound" | "video";

export type TrackLinkPayload = { id: number } | { name: string };
export type SoundLinkPayload = { id: number } | { name: string };
export type VideoLinkPayload = { id: number };

export type MarkdownLightboxSlide = { src: string; alt: string };

export type MarkdownLightboxState = {
  slides: MarkdownLightboxSlide[];
  index: number;
};

export type MarkdownPreviewImageContextValue = {
  accessToken: string | null;
  playUrlCache: React.MutableRefObject<Map<string, string>>;
  resolveImageSrc: (src?: string) => string | undefined;
  resolveSoundIconFromPayload: (payload: SoundLinkPayload) => string | null;
  openLightbox: (src: string, alt: string) => void;
};

export type MarkdownPreviewImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Служебный HAST-узел react-markdown — не пробрасывать в DOM. */
  node?: unknown;
  children?: React.ReactNode;
};

export type MarkdownPreviewParagraphProps = {
  children: React.ReactNode;
  renderLightTokens: (children: React.ReactNode) => React.ReactNode;
  renderLightPanel: (kadrId: string) => React.ReactNode | null;
  hasRoleOrLightLabels: boolean;
  playInlineLabels: boolean;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  onSoundLinkClick?: (soundId: number) => void;
  playFromPayload: (payload: TrackLinkPayload) => void;
  toggleSoundFromPayload: (payload: SoundLinkPayload) => void;
  playVideoFromPayload: (payload: VideoLinkPayload) => void;
  playHoldFromPayload: (holdId?: number | null) => void;
  resolveSoundIconFromPayload: (payload: SoundLinkPayload) => string | null;
};
