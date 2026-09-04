import cn from "classnames";
import { useEffect, useState } from "react";
import { Button } from "../../../shared/core/button/Button";
import { Modal } from "../../../shared/core/modal/Modal";
import type { TheaterHallTemplate } from "../model/theater-hall-templates";
import { TheaterBtn } from "./theater-controls-ui";
import { TheaterHallTemplatePreview } from "./TheaterHallTemplatePreview";

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
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setSelectedId((current) => {
      if (templates.some((template) => template.id === current)) return current;
      return templates[0]?.id ?? "";
    });
  }, [open, templates]);

  const selectedTemplate =
    templates.find((template) => template.id === selectedId) ?? templates[0];
  const previewId = selectedTemplate?.id ?? "";

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
          Наведите на тип — справа 3D зала. Потом размеры можно уточнить в плане.
        </p>
        <div className="theater-hall-quick-start__main">
          <div
            className="theater-hall-quick-start__list"
            role="listbox"
            aria-label="Тип зала"
          >
            {templates.map((template) => {
              const selected = template.id === selectedId;
              return (
                <button
                  key={template.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "theater-hall-quick-start__item",
                    selected && "theater-hall-quick-start__item--active",
                  )}
                  onMouseEnter={() => setSelectedId(template.id)}
                  onFocus={() => setSelectedId(template.id)}
                  onClick={() => setSelectedId(template.id)}
                  onDoubleClick={() => onPick(template.id)}
                >
                  <span className="theater-hall-quick-start__item-label">{template.label}</span>
                  <span className="theater-hall-quick-start__item-desc">
                    {template.description}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="theater-hall-quick-start__preview">
            {previewId ? <TheaterHallTemplatePreview templateId={previewId} /> : null}
          </div>
        </div>
        <div className="theater-hall-quick-start__footer">
          <TheaterBtn onClick={onSkip}>Оставить по умолчанию</TheaterBtn>
          <Button
            variant="primary"
            disabled={!previewId}
            onClick={() => {
              if (previewId) onPick(previewId);
            }}
          >
            Выбрать этот зал
          </Button>
        </div>
      </div>
    </Modal>
  );
}
