import { useEffect, useState } from "react";
import cn from "classnames";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { TheaterModel } from "../../../../../shared/types/script";
import { TheaterBtn, TheaterSelect } from "../../theater-controls-ui";
import type { SpotlightsSectionProps } from "./types";

const TRUSS_FIXTURE_OPTIONS = [
  { value: "regular", label: "Обычный софит" },
  { value: "rgb", label: "RGB-софит" },
];

function TrussListNameInput({
  item,
  active,
  disabled,
  placeholder,
  onSelect,
  onNameCommit,
}: {
  item: TheaterModel;
  active: boolean;
  disabled?: boolean;
  placeholder: string;
  onSelect: (shiftKey: boolean) => void;
  onNameCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(item.name);

  useEffect(() => {
    setDraft(item.name);
  }, [item.id, item.name]);

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed || placeholder;
    if (next !== item.name) {
      onNameCommit(next);
      return;
    }
    if (draft !== item.name) {
      setDraft(item.name);
    }
  };

  return (
    <input
      type="text"
      className={cn(
        "native-text-input",
        "theater-spotlight-name-input",
        active && "theater-spotlight-name-input--active",
      )}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      title="Название"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => onSelect(event.shiftKey)}
      onFocus={() => onSelect(false)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(item.name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function TheaterControlsSpotlightsTrussSection({
  vm,
}: SpotlightsSectionProps) {
  const trusses = vm.models.filter(
    (model) => model.builtin === "lightTruss6m",
  );
  const activeTruss =
    vm.activeModel?.builtin === "lightTruss6m" ? vm.activeModel : null;
  const allVisible =
    trusses.length > 0 && trusses.every((item) => !item.hidden);

  return (
    <div className="theater-spotlight-nav-panel">
      <div className="theater-spotlight-nav-toolbar">
        <TheaterBtn
          onClick={() => vm.addBuiltinModelAt("lightTruss6m")}
          disabled={!vm.currentScene}
          title="Добавить ферму 6 м"
        >
          +
        </TheaterBtn>
        <TheaterBtn
          className="theater-btn--visibility"
          active={allVisible}
          disabled={!vm.currentScene || trusses.length === 0}
          title={allVisible ? "Скрыть все" : "Показать все"}
          onClick={() => {
            const nextHidden = allVisible;
            for (const truss of trusses) {
              if (Boolean(truss.hidden) !== nextHidden) {
                vm.updateModel(truss.id, { hidden: nextHidden });
              }
            }
          }}
        >
          <span className="theater-spotlight-power-dot" />
        </TheaterBtn>
      </div>
      <div className="theater-sidebar-home theater-spotlight-nav-list">
        {trusses.map((truss) => {
          const isSelected =
            truss.id === activeTruss?.id ||
            vm.multiSelectedModelIds.includes(truss.id);
          const isVisible = !truss.hidden;
          const placeholder = `Ферма ${truss.id}`;

          return (
            <div
              key={truss.id}
              className={cn(
                "theater-sidebar-home__item",
                "theater-spotlight-nav-row",
                "theater-spotlight-nav-row--truss",
                isSelected && "theater-spotlight-nav-row--active",
              )}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button, input, select, label")) return;
                vm.selectTheaterModel(truss.id, event.shiftKey);
                vm.setEditMode("models");
              }}
            >
              <svg
                className="theater-sidebar-home__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 8h18M3 16h18M6 8v8M12 8v8M18 8v8" />
              </svg>
              <TrussListNameInput
                item={truss}
                active={isSelected}
                disabled={!vm.currentScene}
                placeholder={placeholder}
                onSelect={(shiftKey) => {
                  vm.selectTheaterModel(truss.id, shiftKey);
                  vm.setEditMode("models");
                }}
                onNameCommit={(name) => vm.updateModel(truss.id, { name })}
              />
              <TheaterBtn
                className="theater-btn--visibility"
                active={isVisible}
                onClick={() =>
                  vm.updateModel(truss.id, { hidden: isVisible })
                }
                disabled={!vm.currentScene}
                title={isVisible ? "Скрыть" : "Показать"}
              >
                <span className="theater-spotlight-power-dot" />
              </TheaterBtn>
              <TheaterBtn
                className="theater-btn--danger"
                disabled={!vm.currentScene}
                title="Удалить ферму"
                onClick={() => vm.removeModel(truss.id)}
              >
                ×
              </TheaterBtn>
            </div>
          );
        })}
        {trusses.length === 0 ? (
          <span className="theater-spotlight-empty">Ферм нет</span>
        ) : null}
      </div>

      {activeTruss ? (
        <div className="theater-spotlight-nav-footer">
          <div className="theater-btn-row">
            <TheaterBtn
              active={vm.editMode === "models"}
              onClick={() => vm.setEditMode("models")}
            >
              Установить
            </TheaterBtn>
            <TheaterBtn
              active={vm.editMode === "spotlights"}
              onClick={() => vm.setEditMode("spotlights")}
            >
              Зафиксировать
            </TheaterBtn>
          </div>
          <LabeledCheckbox
            checked={activeTruss.modelLowDetail ?? false}
            onChange={(modelLowDetail) =>
              vm.updateModel(activeTruss.id, { modelLowDetail })
            }
          >
            Упрощённая 3D-модель
          </LabeledCheckbox>
          <TheaterSelect
            label="Софит для точки"
            value={vm.trussMountFixtureType}
            options={TRUSS_FIXTURE_OPTIONS}
            onChange={(fixtureType) => {
              if (fixtureType !== "regular" && fixtureType !== "rgb") return;
              vm.setTrussMountFixtureType(fixtureType);
            }}
          />
          <span className="theater-spotlight-empty">
            Наведите курсор на точку фермы и нажмите, чтобы установить выбранный
            софит.
          </span>
        </div>
      ) : null}
    </div>
  );
}
