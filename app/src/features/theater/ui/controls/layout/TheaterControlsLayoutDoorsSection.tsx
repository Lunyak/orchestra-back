import cn from "classnames";
import {
  THEATER_DOOR_STYLE_LABELS,
  THEATER_DOOR_WALL_LABELS,
} from "../../../model/theater-doors";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { TheaterDoorStyle } from "../../../../../shared/types/script";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutDoorsSection({ vm }: LayoutSectionProps) {
  const stageShape = vm.layout.stageShape ?? "rectangle";
  if (stageShape === "custom" || stageShape === "circle") return null;

  const activeDoor = vm.layoutDoors.find((door) => door.id === vm.activeDoorId);
  const canRemove = vm.layoutDoors.length > 1;

  return (
    <TheaterCollapsibleSection
      sectionId="layout-doors"
      title="Двери"
      badge={vm.layoutDoors.length > 0 ? String(vm.layoutDoors.length) : undefined}
      className="theater-panel-section--compact-labels"
      headerActions={
        <>
          <TheaterBtn
            onClick={() => vm.addDoor("left")}
            title="Добавить дверь слева"
          >
            +
          </TheaterBtn>
        </>
      }
    >
      <div className="theater-spotlight-list theater-spotlight-list--scroll theater-door-list--rows">
        {vm.layoutDoors.map((door) => {
          const isSelected = door.id === vm.activeDoorId;
          const styleLabel =
            THEATER_DOOR_STYLE_LABELS[door.style === "metal" ? "metal" : "wood"];
          const label = `${THEATER_DOOR_WALL_LABELS[door.wall]} · ${styleLabel} · ${door.width}×${door.height}`;
          return (
            <div
              key={door.id}
              className={cn("theater-spotlight-tab", "theater-spotlight-tab--door")}
            >
              <button
                type="button"
                className={cn(
                  "theater-door-list__name",
                  isSelected && "theater-door-list__name--active",
                )}
                title={label}
                onClick={() => vm.setActiveDoorId(door.id)}
              >
                {label}
              </button>
              <TheaterBtn
                className="theater-btn--danger"
                disabled={!canRemove}
                title="Удалить дверь"
                onClick={() => vm.removeActiveDoor(door.id)}
              >
                ×
              </TheaterBtn>
            </div>
          );
        })}
        {vm.layoutDoors.length === 0 ? (
          <span className="theater-spotlight-empty">Дверей нет</span>
        ) : null}
      </div>

      {activeDoor ? (
        <div className="theater-layout-grid">
          <TheaterField label="Стена">
            <select
              className="native-text-input"
              value={activeDoor.wall}
              onChange={(event) =>
                vm.updateActiveDoor({
                  wall: event.target.value as "left" | "right" | "back" | "front",
                })
              }
            >
              <option value="left">Левая</option>
              <option value="right">Правая</option>
              <option value="back">Задняя (сцена)</option>
              <option value="front">Передняя (зал)</option>
            </select>
          </TheaterField>
          <TheaterField label="Вид">
            <select
              className="native-text-input"
              value={activeDoor.style === "metal" ? "metal" : "wood"}
              onChange={(event) =>
                vm.updateActiveDoor({
                  style: event.target.value as TheaterDoorStyle,
                })
              }
            >
              <option value="wood">{THEATER_DOOR_STYLE_LABELS.wood}</option>
              <option value="metal">{THEATER_DOOR_STYLE_LABELS.metal}</option>
            </select>
          </TheaterField>
          <TheaterField label={labelM("Позиция")}>
            <input
              type="number"
              className="native-text-input"
              step={0.5}
              value={activeDoor.pos}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveDoor({ pos: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Ширина")}>
            <input
              type="number"
              className="native-text-input"
              min={0.8}
              max={3}
              step={0.1}
              value={activeDoor.width}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveDoor({
                  width: Math.max(0.8, Number(event.target.value) || 1.2),
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Высота")}>
            <input
              type="number"
              className="native-text-input"
              min={1.5}
              step={0.1}
              value={activeDoor.height}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveDoor({
                  height: Math.max(1.5, Number(event.target.value) || 2.2),
                })
              }
            />
          </TheaterField>
        </div>
      ) : null}
    </TheaterCollapsibleSection>
  );
}
