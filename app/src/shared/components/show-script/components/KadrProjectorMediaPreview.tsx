import { useContext, useMemo } from "react";
import { ProjectorMediaPreview } from "../../../../features/projector/ui/ProjectorMediaPreview";
import { MarkdownKadrMediaContext } from "./markdown-kadr-media-context";

type KadrProjectorMediaPreviewProps = {
  mode: "video" | "hold";
  videoId?: number | null;
  holdId?: number | null;
  title: string;
  onActivate: () => void;
};

export function KadrProjectorMediaPreview({
  mode,
  videoId = null,
  holdId = null,
  title,
  onActivate,
}: KadrProjectorMediaPreviewProps) {
  const media = useContext(MarkdownKadrMediaContext);
  const ctx = useMemo(
    () => ({
      projectSlug: media.projectSlug,
      videos: media.videos,
      holdImages: media.holdImages,
      projector: media.projector ?? null,
    }),
    [media.holdImages, media.projectSlug, media.projector, media.videos],
  );

  return (
    <ProjectorMediaPreview
      ctx={ctx}
      mode={mode}
      videoId={videoId}
      holdId={holdId}
      title={title}
      className="markdown-kadr-media-preview"
      fallbackClassName="markdown-kadr-media-preview__fallback"
      interactive
      onActivate={onActivate}
    />
  );
}
