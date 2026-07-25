import { Modal } from "../../../shared/core/modal/Modal";
import type { TheaterHallTemplate } from "../model/theater-hall-templates";
import { TheaterBtn } from "./theater-controls-ui";

type TheaterHallQuickStartModalProps = {
  open: boolean;
  templates: TheaterHallTemplate[];
  onPick: (templateId: string) => void;
  onSkip: () => void;
};

export function TheaterHallQuickStartModal({
  open,
  templates,
  onPick,
  onSkip,
}: TheaterHallQuickStartModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onSkip}
      ariaLabelledBy="theater-hall-quick-start-title"
      panelClassName="theater-hall-quick-start"
    >
      <div className="theater-hall-quick-start__body">
        <h2 id="theater-hall-quick-start-title" className="theater-hall-quick-start__title">
          Выберите тип зала
        </h2>
        <p className="theater-hall-quick-start__hint">
          Один раз в начале. Потом размеры и форму можно уточнить в плане зала.
        </p>
        <div className="theater-hall-quick-start__list" role="list">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="theater-hall-quick-start__item"
              role="listitem"
              onClick={() => onPick(template.id)}
            >
              <span className="theater-hall-quick-start__item-label">{template.label}</span>
              <span className="theater-hall-quick-start__item-desc">
                {template.description}
              </span>
            </button>
          ))}
        </div>
        <div className="theater-hall-quick-start__footer">
          <TheaterBtn onClick={onSkip}>Оставить по умолчанию</TheaterBtn>
        </div>
      </div>
    </Modal>
  );
}
