import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterSelect } from "../../theater-controls-ui";
import type { SpotlightsSectionProps } from "./types";

const TRUSS_FIXTURE_OPTIONS = [
  { value: "regular", label: "Обычный софит" },
  { value: "rgb", label: "RGB-софит" },
];

export function TheaterControlsSpotlightsTrussSection({
  vm,
}: SpotlightsSectionProps) {
  const trusses = vm.models.filter(
    (model) => model.builtin === "lightTruss6m",
  );
  const activeTruss =
    vm.activeModel?.builtin === "lightTruss6m" ? vm.activeModel : null;

  return (
    <TheaterCollapsibleSection
      sectionId="spotlights-trusses"
      title="Световые фермы"
      summary="Установка и монтаж софитов"
      badge={trusses.length > 0 ? String(trusses.length) : undefined}
      defaultOpen
    >
      <div className="theater-spotlight-list">
        {trusses.map((truss) => (
          <TheaterBtn
            key={truss.id}
            active={truss.id === activeTruss?.id}
            onClick={() => {
              vm.selectTheaterModel(truss.id);
              vm.setEditMode("models");
            }}
          >
            {truss.name}
          </TheaterBtn>
        ))}
        {trusses.length === 0 ? (
          <span className="theater-spotlight-empty">Ферм нет</span>
        ) : null}
      </div>

      <div className="theater-btn-row">
        <TheaterBtn
          onClick={() => vm.addBuiltinModelAt("lightTruss6m")}
          disabled={!vm.currentScene}
        >
          + Ферма 6 м
        </TheaterBtn>
        <TheaterBtn
          className="theater-btn--danger"
          onClick={() => activeTruss && vm.removeModel(activeTruss.id)}
          disabled={!activeTruss}
        >
          Удалить
        </TheaterBtn>
      </div>

      {activeTruss ? (
        <>
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
        </>
      ) : null}
    </TheaterCollapsibleSection>
  );
}
