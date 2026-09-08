import cn from "classnames";
import {
  OPENING_HEIGHT_LIMITS,
  OPENING_WIDTH_LIMITS,
  THEATER_OPENING_WALL_LABELS,
} from "../../../model/theater-wall-openings";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { TheaterDoorWall } from "../../../../../shared/types/script";
import type { LayoutSectionProps } from "./types";

const DEFAULT_FALLBACK_WIDTH = 1.5;
const DEFAULT_FALLBACK_HEIGHT = 2.2;

export function TheaterControlsLayoutOpeningsSection({ vm }: LayoutSectionProps) {
  const stageShape = vm.layout.stageShape ?? "rectangle";
  if (stageShape === "custom" || stageShape === "circle") return null;

  const activeOpening = vm.layoutOpenings.find(
    (item) => item.id === vm.activeOpeningId,
  );

  return (
    <TheaterCollapsibleSection
      sectionId="layout-openings"
      title="Проёмы"
      badge={
        vm.layoutOpenings.length > 0 ? String(vm.layoutOpenings.length) : undefined
      }
      className="theater-panel-section--compact-labels"
      headerActions={
        <TheaterBtn
          onClick={() => vm.addWallOpening("left")}
          title="Добавить проём"
        >
          +
        </TheaterBtn>
      }
    >
      <div className="theater-spotlight-list theater-spotlight-list--scroll theater-door-list--rows">
        {vm.layoutOpenings.map((opening) => {
          const isSelected = opening.id === vm.activeOpeningId;
          const sill = opening.sill ?? 0;
          const label = `${THEATER_OPENING_WALL_LABELS[opening.wall]} · ${opening.width}×${opening.height}${sill > 0 ? ` · +${sill}` : ""}`;
          return (
            <div
              key={opening.id}
              className={cn("theater-spotlight-tab", "theater-spotlight-tab--door")}
            >
              <button
                type="button"
                className={cn(
                  "theater-door-list__name",
                  isSelected && "theater-door-list__name--active",
                )}
                title={label}
                onClick={() => vm.setActiveOpeningId(opening.id)}
              >
                {label}
              </button>
              <TheaterBtn
                className="theater-btn--danger"
                title="Удалить проём"
                onClick={() => vm.removeActiveWallOpening(opening.id)}
              >
                ×
              </TheaterBtn>
            </div>
          );
        })}
        {vm.layoutOpenings.length === 0 ? (
          <span className="theater-spotlight-empty">Проёмов нет</span>
        ) : null}
      </div>

      <p className="theater-layout-hint">
        Проём — сквозное отверстие в стене, без двери.
      </p>

      {activeOpening ? (
        <div className="theater-layout-grid">
          <TheaterField label="Стена">
            <select
              className="native-text-input"
              value={activeOpening.wall}
              onChange={(event) =>
                vm.updateActiveWallOpening({
                  wall: event.target.value as TheaterDoorWall,
                })
              }
            >
              <option value="left">Левая</option>
              <option value="right">Правая</option>
              <option value="back">Задняя</option>
              <option value="front">Передняя</option>
            </select>
          </TheaterField>
          <TheaterField label={labelM("Позиция")}>
            <input
              type="number"
              className="native-text-input"
              step={0.5}
              value={activeOpening.pos}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveWallOpening({
                  pos: Number(event.target.value) || 0,
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Ширина")}>
            <input
              type="number"
              className="native-text-input"
              min={OPENING_WIDTH_LIMITS.min}
              max={OPENING_WIDTH_LIMITS.max}
              step={0.1}
              value={activeOpening.width}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveWallOpening({
                  width: Math.max(
                    OPENING_WIDTH_LIMITS.min,
                    Number(event.target.value) || DEFAULT_FALLBACK_WIDTH,
                  ),
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Высота")}>
            <input
              type="number"
              className="native-text-input"
              min={OPENING_HEIGHT_LIMITS.min}
              step={0.1}
              value={activeOpening.height}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveWallOpening({
                  height: Math.max(
                    OPENING_HEIGHT_LIMITS.min,
                    Number(event.target.value) || DEFAULT_FALLBACK_HEIGHT,
                  ),
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("От пола")}>
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={0.1}
              value={activeOpening.sill ?? 0}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveWallOpening({
                  sill: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </TheaterField>
        </div>
      ) : null}
    </TheaterCollapsibleSection>
  );
}
