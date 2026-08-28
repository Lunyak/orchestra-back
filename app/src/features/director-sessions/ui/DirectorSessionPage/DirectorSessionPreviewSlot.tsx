import { markdownToPlainText } from "../../../../shared/utils/textPreview";

export type DirectorSessionPreviewSlotScene = {
  playMarkdown?: string;
  markdown?: string;
} | null | undefined;

export type DirectorSessionPreviewSlotProps = {
  selectedScene: DirectorSessionPreviewSlotScene;
};

export function DirectorSessionPreviewSlot({
  selectedScene,
}: DirectorSessionPreviewSlotProps) {
  const text = String(
    selectedScene?.playMarkdown ?? selectedScene?.markdown ?? "",
  );
  const plain = markdownToPlainText(text);
  const previewText =
    plain.slice(0, 1600) + (plain.length > 1600 ? "\n\n… (обрезано)" : "");
  const hasPreview = Boolean(plain.trim());

  if (!hasPreview) return null;

  return (
    <details className="director-session-page__preview-fold">
      <summary className="director-session-page__preview-fold-summary">
        Превью текста сцены
      </summary>
      <pre className="director-session-page__preview-pre">{previewText}</pre>
    </details>
  );
}
