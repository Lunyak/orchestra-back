import cn from "classnames";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { AppEditorScriptSceneTitle } from "../../app-editor-menubar";
import { ActorAnnotationsPopover } from "../annotations/ActorAnnotationsPopover";
import {
  useScriptMarkdownPreview,
  type ScriptMarkdownPreviewProps,
} from "../hooks/useScriptMarkdownPreview";
import "../../light-console/light-console.css";
import { MarkdownKadrMediaContext } from "./markdown-kadr-media-context";
import {
  MarkdownPreviewLightTokensBridgeContext,
  MarkdownPreviewParagraphBridgeContext,
} from "./markdown-preview-context";
import { MarkdownPreviewImageContext } from "./MarkdownPreviewImage";
import { ScriptMarkdownLightbox } from "./ScriptMarkdownLightbox";
import { createScriptMarkdownPreviewComponents } from "./scriptMarkdownPreviewComponents";

export type { ScriptMarkdownPreviewProps };

export function ScriptMarkdownPreview(props: ScriptMarkdownPreviewProps) {
  const {
    markdownForPreview,
    rehypePlugins,
    urlTransform,
    lightbox,
    setLightbox,
    dialogLabelSlotPx,
    rootRef,
    annotationsMode,
    annotationsPopoverProps,
    setAnchorFromRect,
    markdownPreviewImageCtx,
    markdownParagraphProps,
    renderLightTokens,
    renderLightPanel,
    kadrMediaLookup,
    kadrLayoutEnabled,
    hasRoleOrLightLabels,
    markdownMode,
    hasSceneTitle,
    sceneTitleText,
    currentSceneTitle,
    isModeEditing,
    onToggleModeEditing,
    readModeActivateEdit,
    onReadModePointerDown,
    handleMarkdownMouseUp,
    handleSpeakerLabelClick,
    onTrackLinkClick,
    onSoundLinkClick,
    playFromPayload,
    toggleSoundFromPayload,
    playVideoFromPayload,
    playHoldFromPayload,
    resolveTrackLink,
    resolveSoundLink,
    resolveVideoLink,
    resolveHoldLink,
    isAudioLink,
    setNewAnnotation,
    setActiveAnnotationId,
  } = useScriptMarkdownPreview(props);

  const markdownComponents = createScriptMarkdownPreviewComponents({
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
  });

  const previewClassName = cn(
    "markdown-preview",
    hasSceneTitle && "markdown-preview--with-scene-title",
    hasRoleOrLightLabels && "markdown-preview--has-line-labels",
    markdownMode === "play" && "markdown-preview--play-inline-labels",
    kadrLayoutEnabled && "markdown-preview--kadr",
    readModeActivateEdit && "markdown-preview--read-activatable",
  );

  const previewStyle =
    dialogLabelSlotPx != null
      ? ({
          ["--dialog-label-slot-width" as string]: `${dialogLabelSlotPx}px`,
        } as React.CSSProperties)
      : undefined;

  const closeLightbox = () => setLightbox(null);
  const goLightboxPrev = () =>
    setLightbox((prev) =>
      !prev || prev.slides.length <= 1
        ? prev
        : {
            ...prev,
            index: (prev.index - 1 + prev.slides.length) % prev.slides.length,
          },
    );
  const goLightboxNext = () =>
    setLightbox((prev) =>
      !prev || prev.slides.length <= 1
        ? prev
        : { ...prev, index: (prev.index + 1) % prev.slides.length },
    );

  return (
    <div className={previewClassName} style={previewStyle}>
      {hasSceneTitle && onToggleModeEditing ? (
        <div className="script-scene-title-mount">
          <AppEditorScriptSceneTitle
            title={currentSceneTitle}
            titleEditable={false}
            onTitleChange={() => {}}
            isModeEditing={isModeEditing}
            onToggleModeEditing={onToggleModeEditing}
          />
        </div>
      ) : hasSceneTitle ? (
        <div className="script-scene-title-mount">
          <div className="script-scene-title app-editor-menubar__scene-title">
            {sceneTitleText}
          </div>
        </div>
      ) : null}
      <div
        ref={rootRef}
        className="markdown-preview__body"
        onClick={handleSpeakerLabelClick}
        onPointerDownCapture={
          readModeActivateEdit ? onReadModePointerDown : undefined
        }
        onMouseUp={annotationsMode ? handleMarkdownMouseUp : undefined}
      >
        <MarkdownPreviewImageContext.Provider value={markdownPreviewImageCtx}>
          <MarkdownPreviewParagraphBridgeContext.Provider
            value={markdownParagraphProps}
          >
            <MarkdownPreviewLightTokensBridgeContext.Provider
              value={renderLightTokens}
            >
              <MarkdownKadrMediaContext.Provider value={kadrMediaLookup}>
                <ReactMarkdown
                  urlTransform={urlTransform}
                  remarkPlugins={[remarkBreaks]}
                  rehypePlugins={rehypePlugins}
                  components={markdownComponents}
                >
                  {markdownForPreview || "*Пусто*"}
                </ReactMarkdown>
              </MarkdownKadrMediaContext.Provider>
            </MarkdownPreviewLightTokensBridgeContext.Provider>
          </MarkdownPreviewParagraphBridgeContext.Provider>
        </MarkdownPreviewImageContext.Provider>
      </div>

      <ScriptMarkdownLightbox
        lightbox={lightbox}
        onClose={closeLightbox}
        onPrev={goLightboxPrev}
        onNext={goLightboxNext}
      />

      {annotationsMode ? (
        <ActorAnnotationsPopover {...annotationsPopoverProps} />
      ) : null}
    </div>
  );
}
