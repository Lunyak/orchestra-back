import cn from "classnames";
import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { MarkdownPreviewParagraph } from "../../../shared/components/show-script/components/markdown-preview-components";
import {
  expandScriptLineParagraphBreaks,
  injectNbspParagraphsForTripleNewlines,
  markdownHasRoleLightOrPlayLineLabels,
  protectRoleLabelParentheticals,
} from "../../../shared/components/show-script/components/markdown-preview-normalize";
import type { MarkdownPreviewParagraphProps } from "../../../shared/components/show-script/components/markdown-preview-types";
import {
  createRehypeScriptTokens,
  createRenderLightTokens,
} from "../../../shared/components/show-script/utils/lightTokens";
import "../../../shared/components/show-script/style.css";

export type FormatPlayMarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

const noopPayload = () => undefined;
const noopHold = (_holdId?: number | null) => undefined;
const resolveNoIcon = () => null;
const renderNoPanel = () => null;

export function FormatPlayMarkdownPreview({
  markdown,
  className,
}: FormatPlayMarkdownPreviewProps) {
  const markdownForPreview = useMemo(() => {
    const expanded = expandScriptLineParagraphBreaks(String(markdown ?? ""), false, 0);
    const withProtectedRemarks = protectRoleLabelParentheticals(expanded);
    return injectNbspParagraphsForTripleNewlines(withProtectedRemarks);
  }, [markdown]);

  const hasRoleOrLightLabels = useMemo(
    () => markdownHasRoleLightOrPlayLineLabels(markdown || ""),
    [markdown],
  );

  const renderLightTokens = useMemo(() => createRenderLightTokens([]), []);
  const rehypeScriptTokens = useMemo(() => createRehypeScriptTokens([]), []);

  const paragraphProps = useMemo(
    (): Omit<MarkdownPreviewParagraphProps, "children"> => ({
      renderLightTokens,
      renderLightPanel: renderNoPanel,
      hasRoleOrLightLabels,
      playInlineLabels: true,
      playFromPayload: noopPayload,
      toggleSoundFromPayload: noopPayload,
      playVideoFromPayload: noopPayload,
      playHoldFromPayload: noopHold,
      resolveSoundIconFromPayload: resolveNoIcon,
    }),
    [hasRoleOrLightLabels, renderLightTokens],
  );

  if (!markdownForPreview.trim()) {
    return <div className={cn("format-play-text-modal__md-preview", className)}>—</div>;
  }

  return (
    <div
      className={cn(
        "format-play-text-modal__md-preview",
        "markdown-preview",
        "markdown-preview--play-inline-labels",
        hasRoleOrLightLabels && "markdown-preview--has-line-labels",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        rehypePlugins={[rehypeScriptTokens]}
        components={{
          p: ({ children }: { children?: ReactNode }) => (
            <MarkdownPreviewParagraph {...paragraphProps}>
              {children}
            </MarkdownPreviewParagraph>
          ),
        }}
      >
        {markdownForPreview}
      </ReactMarkdown>
    </div>
  );
}
