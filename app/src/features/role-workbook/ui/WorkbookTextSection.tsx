import cn from "classnames";
import type { ReactNode } from "react";
import type { RoleWorkbookDataV1 } from "../model/roleWorkbookNote";

export type WorkbookTextFieldKey = keyof Omit<
  RoleWorkbookDataV1,
  | "v"
  | "actorEmail"
  | "referenceImages"
  | "referenceLinksLegacy"
  | "sceneArcs"
  | "relationshipEntries"
  | "directorQuestions"
  | "savedAtIso"
>;

type WorkbookTextSectionProps = {
  sectionNum: number;
  title: string;
  hint?: ReactNode;
  fieldKey: WorkbookTextFieldKey;
  rows: number;
  placeholder: string;
  value: string;
  canEdit: boolean;
  onFieldChange: (key: WorkbookTextFieldKey, value: string) => void;
};

export function WorkbookTextSection(props: WorkbookTextSectionProps) {
  const {
    sectionNum,
    title,
    hint,
    fieldKey,
    rows,
    placeholder,
    value,
    canEdit,
    onFieldChange,
  } = props;

  return (
    <div className="rolewb-card rolewb-section" id={`rolewb-section-${fieldKey}`}>
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">{sectionNum}</span>
        <div className="rolewb-card-title">{title}</div>
      </div>
      {hint ? <div className="rolewb-hint">{hint}</div> : null}
      <textarea
        className={cn("settings-invite-input", "rolewb-textarea")}
        rows={rows}
        placeholder={placeholder}
        value={value}
        readOnly={!canEdit}
        onChange={(e) => onFieldChange(fieldKey, e.target.value)}
      />
    </div>
  );
}
