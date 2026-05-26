export type WorkbookTransformationSectionProps = {
  sectionNum: number;
  start: string;
  end: string;
  turningPoint: string;
  canEdit: boolean;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  onChangeTurningPoint: (value: string) => void;
};

export function WorkbookTransformationSection(props: WorkbookTransformationSectionProps) {
  const {
    sectionNum,
    start,
    end,
    turningPoint,
    canEdit,
    onChangeStart,
    onChangeEnd,
    onChangeTurningPoint,
  } = props;

  return (
    <div className="rolewb-card rolewb-section" id="rolewb-section-transformation">
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">{sectionNum}</span>
        <div className="rolewb-card-title">Линия трансформации</div>
      </div>
      <div className="rolewb-hint">
        Итог рисунка роли: кем герой входит в историю, кем выходит и где главный перелом.
      </div>
      <div className="rolewb-transform-grid">
        <label className="rolewb-scene-field">
          <span className="rolewb-scene-field-label">В начале пьесы</span>
          <textarea
            className="settings-invite-input"
            rows={3}
            value={start}
            disabled={!canEdit}
            onChange={(e) => onChangeStart(e.target.value)}
            style={{ maxWidth: "unset", width: "100%" }}
            placeholder="Кем я был? Как себя ощущал? Что считал нормой?"
          />
        </label>
        <label className="rolewb-scene-field">
          <span className="rolewb-scene-field-label">К финалу</span>
          <textarea
            className="settings-invite-input"
            rows={3}
            value={end}
            disabled={!canEdit}
            onChange={(e) => onChangeEnd(e.target.value)}
            style={{ maxWidth: "unset", width: "100%" }}
            placeholder="Кем стал? Что больше не могу / не хочу? Что понял?"
          />
        </label>
        <label className="rolewb-scene-field rolewb-transform-full">
          <span className="rolewb-scene-field-label">Главный перелом</span>
          <textarea
            className="settings-invite-input"
            rows={3}
            value={turningPoint}
            disabled={!canEdit}
            onChange={(e) => onChangeTurningPoint(e.target.value)}
            style={{ maxWidth: "unset", width: "100%" }}
            placeholder="Сцена или событие, после которого всё по-другому. Почему именно оно?"
          />
        </label>
      </div>
    </div>
  );
}
