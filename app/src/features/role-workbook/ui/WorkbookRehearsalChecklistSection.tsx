import cn from "classnames";

export type WorkbookRehearsalChecklistSectionProps = {
  sectionNum: number;
  done: string;
  todo: string;
  rehearsalFocus: string;
  canEdit: boolean;
  onChangeDone: (value: string) => void;
  onChangeTodo: (value: string) => void;
  onChangeRehearsalFocus: (value: string) => void;
};

export function WorkbookRehearsalChecklistSection({
  sectionNum,
  done,
  todo,
  rehearsalFocus,
  canEdit,
  onChangeDone,
  onChangeTodo,
  onChangeRehearsalFocus,
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
            className={cn("settings-invite-input", "rolewb-textarea")}
            rows={4}
            value={done}
            disabled={!canEdit}
            onChange={(e) => onChangeDone(e.target.value)}
            placeholder="Голос, пластика, костюм, работа с партнёрами, сцены…"
          />
        </label>
        <label className="rolewb-scene-field">
          <span className="rolewb-scene-field-label">Ещё не отработано</span>
          <textarea
            className={cn("settings-invite-input", "rolewb-textarea")}
            rows={4}
            value={todo}
            disabled={!canEdit}
            onChange={(e) => onChangeTodo(e.target.value)}
            placeholder="Что осталось: темп, блокировки, текст, образ…"
          />
        </label>
        <label className="rolewb-scene-field rolewb-transform-full">
          <span className="rolewb-scene-field-label">Следующий шаг на репетицию</span>
          <textarea
            className={cn("settings-invite-input", "rolewb-textarea")}
            rows={3}
            value={rehearsalFocus}
            disabled={!canEdit}
            onChange={(e) => onChangeRehearsalFocus(e.target.value)}
            placeholder="Одна-две конкретные задачи на ближайшую репетицию."
          />
        </label>
      </div>
    </div>
  );
}
