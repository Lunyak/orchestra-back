import { Button } from "../../../shared/core/button/Button";

export type FormatPlayTextLineEditSectionProps = {
  lineEditFieldId: string;
  editingLineNo: number;
  lineEditDraft: string;
  setLineEditDraft: (value: string) => void;
  saveLineEdit: () => void;
  cancelLineEdit: () => void;
};

export function FormatPlayTextLineEditSection({
  lineEditFieldId,
  editingLineNo,
  lineEditDraft,
  setLineEditDraft,
  saveLineEdit,
  cancelLineEdit,
}: FormatPlayTextLineEditSectionProps) {
  return (
    <div className="format-play-text-modal__line-edit">
      <label className="format-play-text-modal__line-edit-label" htmlFor={lineEditFieldId}>
        Правка строки {editingLineNo}
      </label>
      <textarea
        id={lineEditFieldId}
        className="format-play-text-modal__line-edit-input native-text-input"
        value={lineEditDraft}
        rows={3}
        onChange={(event) => setLineEditDraft(event.target.value)}
      />
      <div className="format-play-text-modal__line-edit-actions">
        <Button variant="secondary" onClick={saveLineEdit}>
          Сохранить строку
        </Button>
        <Button variant="ghost" onClick={cancelLineEdit}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
