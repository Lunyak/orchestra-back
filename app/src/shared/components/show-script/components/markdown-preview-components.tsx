import cn from "classnames";
import React, { useContext } from "react";
import type { PlaylistPlayOptions } from "../../../../features/playbook/model/playbook-playback-bridge";
import { parseSoundVolumeFromFieldBody } from "../../../../features/theater/model/kadr-sound";
import { KadrProjectorMediaPreview } from "./KadrProjectorMediaPreview";
import { MarkdownTrackLink } from "./MarkdownTrackLink";
import { MarkdownKadrMediaContext } from "./markdown-kadr-media-context";
import {
  MarkdownKadrBodyContext,
  MarkdownKadrIdContext,
  MarkdownKadrLightColumnContext,
  MarkdownKadrSoundPlaybackContext,
  MarkdownPreviewLightTokensBridgeContext,
  MarkdownPreviewParagraphBridgeContext,
} from "./markdown-preview-context";
import {
  getLeadingSoundPayload,
  getLeadingTrackPayload,
  getSoundPayloadFromLabelEl,
  reactNodeHasRawLightPanelToken,
  reactNodePlainText,
  resolveKadrVideoDisplayTitle,
  splitKadrSoundFieldLine,
  splitKadrTextFieldLine,
  splitKadrVideoFieldLine,
  splitLeadingLineLabel,
} from "./markdown-preview-kadr-parsing";
import type {
  MarkdownPreviewParagraphProps,
  SoundLinkPayload,
  TrackLinkPayload,
  VideoLinkPayload,
} from "./markdown-preview-types";
export function MarkdownPreviewUl({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLUListElement>) {
  const inKadrBody = useContext(MarkdownKadrBodyContext);
  if (inKadrBody) {
    return <div className="markdown-kadr__fields">{children}</div>;
  }
  return (
    <ul className={className} {...rest}>
      {children}
    </ul>
  );
}

export function MarkdownPreviewLi({ children }: { children: React.ReactNode }) {
  const inKadrBody = useContext(MarkdownKadrBodyContext);
  const paragraphProps = useContext(MarkdownPreviewParagraphBridgeContext);
  const renderLightTokens = useContext(MarkdownPreviewLightTokensBridgeContext);
  if (inKadrBody && paragraphProps) {
    return (
      <MarkdownPreviewParagraph {...paragraphProps}>{children}</MarkdownPreviewParagraph>
    );
  }
  return <li>{renderLightTokens ? renderLightTokens(children) : children}</li>;
}

export function MarkdownKadrSection({
  children,
  node: _node,
  ...props
}: React.HTMLAttributes<HTMLElement> & { "data-lk-id"?: string; node?: unknown }) {
  const lkId = props["data-lk-id"];
  return (
    <section {...props}>
      <MarkdownKadrIdContext.Provider
        value={typeof lkId === "string" && lkId ? lkId : null}
      >
        {children}
      </MarkdownKadrIdContext.Provider>
    </section>
  );
}

export function MarkdownPreviewTrackLink({
  resolved,
  onTrackLinkClick,
  playFromPayload,
  children,
}: {
  resolved: TrackLinkPayload;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  playFromPayload: (payload: TrackLinkPayload) => void;
  children: React.ReactNode;
}) {
  const kadrSoundVolume = useContext(MarkdownKadrSoundPlaybackContext);
  const trackId = "id" in resolved ? Number(resolved.id) : undefined;
  const trackName = "name" in resolved ? String(resolved.name) : undefined;
  const playOptions =
    kadrSoundVolume != null ? { volume: kadrSoundVolume } : undefined;

  return (
    <MarkdownTrackLink
      trackId={trackId}
      trackName={trackName}
      onClick={() => {
        if ("id" in resolved) {
          onTrackLinkClick?.(Number(resolved.id), playOptions);
          return;
        }
        if ("name" in resolved) {
          playFromPayload({ name: String(resolved.name) });
        }
      }}
    >
      {children}
    </MarkdownTrackLink>
  );
}

export function MarkdownPreviewParagraph({
  children,
  renderLightTokens,
  renderLightPanel,
  hasRoleOrLightLabels,
  playInlineLabels,
  onTrackLinkClick,
  onSoundLinkClick,
  playFromPayload,
  toggleSoundFromPayload,
  playVideoFromPayload,
  playHoldFromPayload,
  resolveSoundIconFromPayload,
}: MarkdownPreviewParagraphProps) {
  const kadrId = useContext(MarkdownKadrIdContext);
  const inKadrLightColumn = useContext(MarkdownKadrLightColumnContext);
  const inKadrBody = useContext(MarkdownKadrBodyContext);
  const kadrMedia = useContext(MarkdownKadrMediaContext);
  const rendered = renderLightTokens(children);
  const { label, rest, kind } = splitLeadingLineLabel(rendered);
  if (inKadrLightColumn && kadrId) {
    const panel = renderLightPanel(kadrId);
    if (panel) {
      return <div className="markdown-light-kadr-call">{panel}</div>;
    }
  }
  if (inKadrLightColumn) {
    return null;
  }
  if (kadrId && reactNodeHasRawLightPanelToken(rendered)) {
    const panel = renderLightPanel(kadrId);
    if (panel) {
      return <div className="markdown-light-kadr-call">{panel}</div>;
    }
  }
  if (inKadrBody || kadrId) {
    const soundField = splitKadrSoundFieldLine(rendered);
    if (soundField) {
      const hasBody = reactNodePlainText(soundField.rest).trim().length > 0;
      const kadrSoundVolume = parseSoundVolumeFromFieldBody(
        reactNodePlainText(soundField.rest),
      );
      return (
        <MarkdownKadrSoundPlaybackContext.Provider value={kadrSoundVolume}>
          <p className="markdown-dialog-line markdown-dialog-line--kadr-field">
            <span className="markdown-dialog-label">
              <span className="markdown-kadr-field-label">Звук</span>
            </span>
            <span className="markdown-dialog-text">
              {hasBody ? (
                soundField.rest
              ) : (
                <em className="markdown-parenthetical-remark">…</em>
              )}
            </span>
          </p>
        </MarkdownKadrSoundPlaybackContext.Provider>
      );
    }

    const videoField = splitKadrVideoFieldLine(rendered, kadrMedia);
    if (videoField) {
      const videoTitle = resolveKadrVideoDisplayTitle(
        videoField.rest,
        kadrMedia,
        { videoId: videoField.videoId, holdId: videoField.holdId },
        videoField.mediaKind,
      );
      const videoId = videoField.videoId;
      const holdId = videoField.holdId;
      const hasRest = reactNodePlainText(videoField.rest).trim().length > 0;
      const previewMode = videoField.mediaKind === "hold" ? "hold" : "video";
      return (
        <p className="markdown-dialog-line markdown-dialog-line--kadr-field markdown-dialog-line--kadr-projector">
          <span className="markdown-dialog-label">
            <span className="markdown-kadr-field-label">Видео</span>
          </span>
          <span className="markdown-dialog-text markdown-dialog-text--kadr-projector">
            <KadrProjectorMediaPreview
              mode={previewMode}
              videoId={videoId}
              holdId={holdId}
              title={videoTitle}
              onActivate={() => {
                if (previewMode === "video") {
                  if (videoId != null && videoId > 0) {
                    playVideoFromPayload({ id: videoId });
                  }
                  return;
                }
                playHoldFromPayload(holdId);
              }}
            />
            {hasRest ? videoField.rest : null}
          </span>
        </p>
      );
    }

    const textField = splitKadrTextFieldLine(rendered);
    if (textField) {
      const body = reactNodePlainText(textField.rest).trim();
      return (
        <p className="markdown-dialog-line markdown-dialog-line--kadr-field">
          <span className="markdown-dialog-label">
            <span className="markdown-kadr-field-label">{textField.label}</span>
          </span>
          <span className="markdown-dialog-text">
            {body ? textField.rest : <em className="markdown-parenthetical-remark">…</em>}
          </span>
        </p>
      );
    }
  }
  const leadingTrack = onTrackLinkClick ? getLeadingTrackPayload(rendered) : null;
  const leadingSound = onSoundLinkClick ? getLeadingSoundPayload(rendered) : null;
  if (!label) {
    if (leadingTrack) {
      const trackAlignClass = hasRoleOrLightLabels
        ? "markdown-dialog-line--track-align"
        : "markdown-dialog-line--track-compact";
      return (
        <p
          className={cn(
            "markdown-dialog-line",
            "markdown-dialog-line--label-track",
            trackAlignClass,
          )}
        >
          <span className="markdown-dialog-label" aria-hidden="true">
            <button
              type="button"
              className="markdown-track-play"
              title="Воспроизвести"
              onClick={() => playFromPayload(leadingTrack)}
            >
              ▶
            </button>
          </span>
          <span className="markdown-dialog-text">{rendered}</span>
        </p>
      );
    }
    if (leadingSound) {
      const soundAlignClass = hasRoleOrLightLabels
        ? "markdown-dialog-line--track-align"
        : "markdown-dialog-line--track-compact";
      return (
        <p
          className={cn(
            "markdown-dialog-line",
            "markdown-dialog-line--label-sound",
            soundAlignClass,
          )}
        >
          <span className="markdown-dialog-label" aria-hidden="true">
            <button
              type="button"
              className="markdown-sound-play"
              title="Звук: воспроизвести/остановить"
              onClick={() => toggleSoundFromPayload(leadingSound)}
            >
              ▶
            </button>
          </span>
          <span className="markdown-dialog-text">{rendered}</span>
        </p>
      );
    }

    if (!hasRoleOrLightLabels || playInlineLabels) {
      return <p>{rendered}</p>;
    }
    return (
      <p className="markdown-dialog-line markdown-dialog-line--no-label">
        <span className="markdown-dialog-label" aria-hidden="true" />
        <span className="markdown-dialog-text">{rendered}</span>
      </p>
    );
  }
  let labelHasIcon = false;
  const resolvedLabel =
    kind === "sound"
      ? (() => {
          if (!onSoundLinkClick) return label;
          const payload = getSoundPayloadFromLabelEl(label);
          if (!payload) return label;
          const iconUrl = resolveSoundIconFromPayload(payload);
          if (!iconUrl) return label;
          labelHasIcon = true;
          return (
            <span
              className="markdown-sound-label markdown-sound-label--with-icon"
              role="button"
              tabIndex={0}
              title="Звук: воспроизвести/остановить"
              data-sound-id={"id" in payload ? String(payload.id) : undefined}
              data-sound-name={"name" in payload ? String(payload.name) : undefined}
              aria-label="Звук: воспроизвести/остановить"
            >
              <img
                className="markdown-sound-label__img"
                src={iconUrl}
                alt=""
                aria-hidden="true"
              />
              <span className="markdown-sound-label__fallback">SFX</span>
            </span>
          );
        })()
      : label;
  if (kind === "light" && kadrId) {
    const panel = renderLightPanel(kadrId);
    if (panel) {
      return <div className="markdown-light-kadr-call">{panel}</div>;
    }
  }
  const kindClass =
    kind === "light"
      ? "markdown-dialog-line--label-light"
      : kind === "play"
        ? "markdown-dialog-line--label-play"
        : kind === "sound"
          ? "markdown-dialog-line--label-sound"
          : "markdown-dialog-line--label-role";
  return (
    <p
      className={cn(
        "markdown-dialog-line",
        kindClass,
        labelHasIcon && "markdown-dialog-line--label-has-icon",
      )}
    >
      <span className="markdown-dialog-label">{resolvedLabel}</span>
      <span className="markdown-dialog-text">{rest}</span>
    </p>
  );
}

export function isInteractiveMarkdownPreviewTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  if (el.closest("a[href], button, input, textarea, select, audio, video")) return true;
  if (
    el.closest(
      [
        ".markdown-image-btn",
        ".markdown-track-play",
        ".markdown-sound-play",
        ".markdown-light-chip",
        ".markdown-play-label",
        ".markdown-video-label",
        ".markdown-kadr-hold-chip",
        ".markdown-sound-label",
        ".markdown-speaker-label",
        ".markdown-track-link",
        ".markdown-video-link",
        ".markdown-sound-link",
      ].join(", "),
    )
  ) {
    return true;
  }
  return false;
}

