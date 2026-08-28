import cn from "classnames";
import type { FormatWarning } from "../model/detect-format-warnings";
import { FormatPlayMarkdownPreview } from "./FormatPlayMarkdownPreview";

export type FormatPlayTextPreviewSectionProps = {
  sourceText: string;
  displayPreviewText: string;
  displayWarnings: FormatWarning[];
  editingLineNo: number | null;
  previewWarningByLine: Map<number, string>;
  openLineEdit: (lineNo: number, line: string) => void;
};

export function FormatPlayTextPreviewSection({
  sourceText,
  displayPreviewText,
  displayWarnings,
  editingLineNo,
  previewWarningByLine,
  openLineEdit,
}: FormatPlayTextPreviewSectionProps) {
  const hasWarnings = displayWarnings.length > 0;
  const sourceDisplay = sourceText || "—";

  return (
    <div className="format-play-text-modal__preview">
      <div className="format-play-text-modal__pane">
        <div className="format-play-text-modal__pane-title">Было</div>
        <pre className="format-play-text-modal__text">{sourceDisplay}</pre>
      </div>
      <div className="format-play-text-modal__pane">
        <div className="format-play-text-modal__pane-title">Станет · чтение</div>
        {hasWarnings ? (
          <div className="format-play-text-modal__warn-lines" role="list">
            {displayWarnings.map((warning) => {
              const isEditing = editingLineNo === warning.line;
              return (
                <button
                  key={`${warning.line}-${warning.message}`}
                  type="button"
                  role="listitem"
                  className={cn(
                    "format-play-text-modal__warn-line",
                    isEditing && "format-play-text-modal__warn-line--editing",
                  )}
                  title={previewWarningByLine.get(warning.line)}
                  onClick={() => {
                    const line = displayPreviewText.split("\n")[warning.line - 1] ?? "";
                    openLineEdit(warning.line, line);
                  }}
                >
                  стр. {warning.line}: {warning.message}
                </button>
              );
            })}
          </div>
        ) : null}
        <FormatPlayMarkdownPreview markdown={displayPreviewText} />
      </div>
    </div>
  );
}
