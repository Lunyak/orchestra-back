export type WorkbookRehearsalChecklistSectionProps = {
  sectionNum: number;
  done: string;
  todo: string;
  nextStep: string;
  canEdit: boolean;
  onChangeDone: (value: string) => void;
  onChangeTodo: (value: string) => void;
  onChangeNextStep: (value: string) => void;
};

export function WorkbookRehearsalChecklistSection({
  sectionNum,
  done,
  todo,
  nextStep,
  canEdit,
  onChangeDone,
  onChangeTodo,
  onChangeNextStep,
}: WorkbookRehearsalChecklistSectionProps) {
  return (
    <div className="rolewb-card rolewb-section" id="rolewb-section-rehearsalChecklist">
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">{sectionNum}</span>
        <div className="rolewb-card-title">Репетиционный чеклист</div>
      </div>
      <div className="rolewb-hint">
        Рабочая тетрадь: что уже отработано, что впереди и конкретный фокус на ближайшую репетицию.
      </div>
      <div className="rolewb-rehearsal-grid">
        <label className="rolewb-scene-field">
          <span className="rolewb-scene-field-label">Отработано</span>
          <textarea
            className="settings-invite-input"
            rows={4}
            value={done}
            disabled={!canEdit}
            onChange={(e) => onChangeDone(e.target.value)}
            style={{ maxWidth: "unset", width: "100%" }}
            placeholder="Голос, пластика, костюм, работа с партнёрами, сцены…"
          />
        </label>
        <label className="rolewb-scene-field">
          <span className="rolewb-scene-field-label">Ещё не отработано</span>
          <textarea
            className="settings-invite-input"
            rows={4}
            value={todo}
            disabled={!canEdit}
            onChange={(e) => onChangeTodo(e.target.value)}
            style={{ maxWidth: "unset", width: "100%" }}
            placeholder="Что осталось: темп, блокировки, текст, образ…"
          />
        </label>
        <label className="rolewb-scene-field rolewb-transform-full">
          <span className="rolewb-scene-field-label">Следующий шаг на репетицию</span>
          <textarea
            className="settings-invite-input"
            rows={3}
            value={nextStep}
            disabled={!canEdit}
            onChange={(e) => onChangeNextStep(e.target.value)}
            style={{ maxWidth: "unset", width: "100%" }}
            placeholder="Одна-две конкретные задачи на ближайшую репетицию."
          />
        </label>
      </div>
    </div>
  );
}
