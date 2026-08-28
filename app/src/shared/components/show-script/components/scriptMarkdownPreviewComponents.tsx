import React from "react";
import type { PlaylistPlayOptions } from "../../../../features/playbook/model/playbook-playback-bridge";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";
import type { MarkdownKadrMediaLookup } from "./markdown-kadr-media-context";
import {
  MarkdownKadrBodyContext,
  MarkdownKadrLightColumnContext,
  MarkdownKadrPictureColumnContext,
} from "./markdown-preview-context";
import {
  MarkdownKadrSection,
  MarkdownPreviewLi,
  MarkdownPreviewParagraph,
  MarkdownPreviewTrackLink,
  MarkdownPreviewUl,
} from "./markdown-preview-components";
import { looksLikeOpaqueMediaId } from "./markdown-preview-normalize";
import type {
  MarkdownPreviewParagraphProps,
  SoundLinkPayload,
  TrackLinkPayload,
  VideoLinkPayload,
} from "./markdown-preview-types";
import { MarkdownPreviewImage } from "./MarkdownPreviewImage";

export type ScriptMarkdownPreviewComponentsDeps = {
  markdownParagraphProps: Omit<MarkdownPreviewParagraphProps, "children">;
  renderLightTokens: (children: React.ReactNode) => React.ReactNode;
  renderLightPanel: (kadrId: string) => React.ReactNode | null;
  resolveTrackLink: (href?: string) => TrackLinkPayload | null;
  resolveSoundLink: (href?: string) => SoundLinkPayload | null;
  resolveVideoLink: (href?: string) => VideoLinkPayload | null;
  resolveHoldLink: (href?: string) => { id: number } | null;
  isAudioLink: (href?: string) => boolean;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  onSoundLinkClick?: (soundId: number) => void;
  playFromPayload: (payload: TrackLinkPayload) => void;
  toggleSoundFromPayload: (payload: SoundLinkPayload) => void;
  playVideoFromPayload: (payload: VideoLinkPayload) => void;
  playHoldFromPayload: (holdId?: number | null) => void;
  kadrMediaLookup: MarkdownKadrMediaLookup;
  setAnchorFromRect: (rect: DOMRect) => void;
  setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
  setNewAnnotation: React.Dispatch<
    React.SetStateAction<NewAnnotationDraft | null>
  >;
};

export function createScriptMarkdownPreviewComponents(
  deps: ScriptMarkdownPreviewComponentsDeps,
) {
  const {
    markdownParagraphProps,
    renderLightTokens,
    renderLightPanel,
    resolveTrackLink,
    resolveSoundLink,
    resolveVideoLink,
    resolveHoldLink,
    isAudioLink,
    onTrackLinkClick,
    onSoundLinkClick,
    playFromPayload,
    toggleSoundFromPayload,
    playVideoFromPayload,
    playHoldFromPayload,
    kadrMediaLookup,
    setAnchorFromRect,
    setActiveAnnotationId,
    setNewAnnotation,
  } = deps;

  return {
    section: MarkdownKadrSection,
    div: ({
      className,
      children,
      node: _node,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & { node?: unknown }) => {
      const cls = typeof className === "string" ? className : "";
      if (cls.includes("markdown-kadr__light")) {
        return (
          <div className={className} {...rest}>
            <MarkdownKadrLightColumnContext.Provider value>
              {children}
            </MarkdownKadrLightColumnContext.Provider>
          </div>
        );
      }
      if (cls.includes("markdown-kadr__picture")) {
        return (
          <div className={className} {...rest}>
            <MarkdownKadrPictureColumnContext.Provider value>
              {children}
            </MarkdownKadrPictureColumnContext.Provider>
          </div>
        );
      }
      if (cls.includes("markdown-kadr__body")) {
        return (
          <div className={className} {...rest}>
            <MarkdownKadrBodyContext.Provider value>
              {children}
            </MarkdownKadrBodyContext.Provider>
          </div>
        );
      }
      return (
        <div className={className} {...rest}>
          {children}
        </div>
      );
    },
    p: ({ children }: { children: React.ReactNode }) => (
      <MarkdownPreviewParagraph {...markdownParagraphProps}>
        {children}
      </MarkdownPreviewParagraph>
    ),
    ul: MarkdownPreviewUl,
    li: MarkdownPreviewLi,
    span: ({
      className,
      children,
      node: _node,
      ...rest
    }: React.HTMLAttributes<HTMLSpanElement> & {
      "data-lk-id"?: string;
      node?: unknown;
    }) => {
      const classNameStr = Array.isArray(className)
        ? className.filter(Boolean).join(" ")
        : className;
      const lkId = rest["data-lk-id"];
      if (classNameStr?.includes("markdown-light-split-host") && lkId) {
        return (
          <span className="markdown-light-split-host">
            {renderLightPanel(String(lkId))}
          </span>
        );
      }
      return (
        <span className={classNameStr} {...rest}>
          {children}
        </span>
      );
    },
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1>{renderLightTokens(children)}</h1>
    ),
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2>{renderLightTokens(children)}</h2>
    ),
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3>{renderLightTokens(children)}</h3>
    ),
    h4: ({ children }: { children: React.ReactNode }) => (
      <h4>{renderLightTokens(children)}</h4>
    ),
    h5: ({ children }: { children: React.ReactNode }) => (
      <h5>{renderLightTokens(children)}</h5>
    ),
    h6: ({ children }: { children: React.ReactNode }) => (
      <h6>{renderLightTokens(children)}</h6>
    ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote>{renderLightTokens(children)}</blockquote>
    ),
    td: ({ children }: { children: React.ReactNode }) => (
      <td>{renderLightTokens(children)}</td>
    ),
    th: ({ children }: { children: React.ReactNode }) => (
      <th>{renderLightTokens(children)}</th>
    ),
    a: ({
      href,
      children,
      ...rest
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const resolved = resolveTrackLink(href);
      if (resolved && onTrackLinkClick) {
        return (
          <MarkdownPreviewTrackLink
            resolved={resolved}
            onTrackLinkClick={onTrackLinkClick}
            playFromPayload={playFromPayload}
          >
            {children}
          </MarkdownPreviewTrackLink>
        );
      }
      const resolvedSound = resolveSoundLink(href);
      if (resolvedSound && onSoundLinkClick) {
        return (
          <button
            type="button"
            className="markdown-sound-link"
            data-sound-id={
              "id" in resolvedSound ? String(resolvedSound.id) : undefined
            }
            data-sound-name={
              "name" in resolvedSound ? String(resolvedSound.name) : undefined
            }
            onClick={async () => {
              if ("id" in resolvedSound) {
                onSoundLinkClick(Number(resolvedSound.id));
                return;
              }
              if ("name" in resolvedSound) {
                toggleSoundFromPayload({ name: String(resolvedSound.name) });
              }
            }}
          >
            {children}
          </button>
        );
      }
      const resolvedVideo = resolveVideoLink(href);
      if (resolvedVideo) {
        return (
          <button
            type="button"
            className="markdown-video-link"
            data-video-id={String(resolvedVideo.id)}
            onClick={() => playVideoFromPayload(resolvedVideo)}
          >
            {children}
          </button>
        );
      }
      const resolvedHold = resolveHoldLink(href);
      if (resolvedHold) {
        const hold = kadrMediaLookup.holdImages.find(
          (h) => Number(h.id) === resolvedHold.id,
        );
        const label = String(hold?.title ?? "").trim();
        const display =
          label && !looksLikeOpaqueMediaId(label) ? label : "Заставка";
        return (
          <button
            type="button"
            className="markdown-hold-link"
            data-hold-id={String(resolvedHold.id)}
            onClick={() => playHoldFromPayload(resolvedHold.id)}
          >
            {display}
          </button>
        );
      }
      if (isAudioLink(href)) {
        return (
          <a
            href={href}
            className="markdown-track-link markdown-audio-link"
            {...rest}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
    img: ({
      node: _node,
      children: _children,
      ...imgProps
    }: React.ImgHTMLAttributes<HTMLImageElement> & {
      node?: unknown;
      children?: React.ReactNode;
    }) => <MarkdownPreviewImage {...imgProps} />,
    mark: ({ node, children, ...rest }: any) => {
      const id = (node as any)?.properties?.["data-anno-id"] as
        | string
        | undefined;
      return (
        <mark
          {...rest}
          onClick={(e) => {
            if (!id) return;
            e.preventDefault();
            e.stopPropagation();
            setAnchorFromRect(
              (e.currentTarget as HTMLElement).getBoundingClientRect(),
            );
            setActiveAnnotationId((prev) => (prev === id ? null : id));
            setNewAnnotation(null);
          }}
        >
          {children}
        </mark>
      );
    },
    code: ({
      className,
      children,
      node,
      ...rest
    }: {
      className?: string;
      children: React.ReactNode;
      node?: unknown;
    } & React.HTMLAttributes<HTMLElement>) => {
      const classStr = String(className ?? "");
      const isCodeBlock =
        /\blanguage-/.test(classStr) ||
        String(children ?? "").includes("\n");

      if (!isCodeBlock) {
        const text = String(children ?? "").replace(/\n/g, " ").trim();
        return (
          <code
            className="markdown-inline-code-label"
            title={text || undefined}
            {...rest}
          >
            {text || children}
          </code>
        );
      }
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
  };
}
