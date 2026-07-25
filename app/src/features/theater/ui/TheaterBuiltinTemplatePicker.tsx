import cn from "classnames";
import { useState } from "react";
import type { TheaterBuiltinTemplateKey } from "../model/theater-model-builtin";
import { THEATER_BUILTIN_TEMPLATES } from "../model/theater-model-builtin";
import { writeTheaterBuiltinTemplateDrag } from "../model/theater-builtin-template-dnd";
import { TheaterBuiltinTemplatePreview } from "./TheaterBuiltinTemplatePreview";

type TheaterBuiltinTemplatePickerProps = {
  value: TheaterBuiltinTemplateKey | undefined;
  onChange: (key: TheaterBuiltinTemplateKey) => void;
  dragEnabled?: boolean;
};

export function TheaterBuiltinTemplatePicker({
  value,
  onChange,
  dragEnabled = true,
}: TheaterBuiltinTemplatePickerProps) {
  const [filter, setFilter] = useState("");
  const previewBuiltin = value ?? THEATER_BUILTIN_TEMPLATES[0].key;
  const normalizedFilter = filter.trim().toLocaleLowerCase("ru");
  const filteredTemplates = !normalizedFilter
    ? THEATER_BUILTIN_TEMPLATES
    : THEATER_BUILTIN_TEMPLATES.filter((item) =>
        item.label.toLocaleLowerCase("ru").includes(normalizedFilter),
      );

  return (
    <div className="theater-builtin-template-picker">
      <TheaterBuiltinTemplatePreview builtin={previewBuiltin} />
      <input
        type="search"
        className="theater-builtin-template-filter native-text-input"
        placeholder="Поиск…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div
        className="theater-spotlight-list theater-builtin-template-list"
        role="listbox"
        aria-label="Модели"
      >
        {filteredTemplates.length === 0 ? (
          <p className="theater-builtin-template-list__empty">Ничего не найдено</p>
        ) : (
          filteredTemplates.map((item) => {
            const selected = value === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="option"
                aria-selected={selected}
                title={item.label}
                draggable={dragEnabled}
                className={cn(
                  "theater-builtin-template-list__item",
                  selected && "theater-builtin-template-list__item--active",
                  dragEnabled && "theater-builtin-template-list__item--draggable",
                )}
                onClick={() => onChange(item.key)}
                onDragStart={(event) => {
                  if (!dragEnabled) return;
                  onChange(item.key);
                  writeTheaterBuiltinTemplateDrag(event.dataTransfer, item.key);
                }}
              >
                {item.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
