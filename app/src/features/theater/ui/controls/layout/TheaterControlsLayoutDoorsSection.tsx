import { THEATER_DOOR_WALL_LABELS } from "../../../model/theater-doors";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutDoorsSection({ vm }: LayoutSectionProps) {
  if ((vm.layout.stageShape ?? "rectangle") === "custom") return null;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-doors"
        title="Двери"
        summary="Проёмы в стенах"
        badge={vm.layoutDoors.length > 0 ? String(vm.layoutDoors.length) : undefined}
      >
<div className="theater-door-list">
            {vm.layoutDoors.map((door) => (
              <TheaterBtn
                key={door.id}
                active={door.id === vm.activeDoorId}
                onClick={() => vm.setActiveDoorId(door.id)}
                title={`${THEATER_DOOR_WALL_LABELS[door.wall]} · ${door.width}×${door.height} м`}
              >
                #{door.id} {THEATER_DOOR_WALL_LABELS[door.wall]}
              </TheaterBtn>
            ))}
          </div>
          <div className="theater-door-actions">
            <TheaterBtn onClick={() => vm.addDoor("left")}>+ Левая</TheaterBtn>
            <TheaterBtn onClick={() => vm.addDoor("right")}>+ Правая</TheaterBtn>
            <TheaterBtn onClick={() => vm.addDoor("back")}>+ Задняя</TheaterBtn>
            <TheaterBtn
              onClick={vm.removeActiveDoor}
              disabled={vm.layoutDoors.length <= 1 || vm.activeDoorId == null}
            >
              Удалить
            </TheaterBtn>
          </div>
          {vm.activeDoorId != null ? (
            <div className="theater-layout-grid">
              <TheaterField label="Стена">
                <select
                  className="native-text-input"
                  value={vm.layoutDoors.find((door) => door.id === vm.activeDoorId)?.wall ?? "left"}
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
              <TheaterField label={labelM("Позиция")}>
                <input
                  type="number"
                  className="native-text-input"
                  step={0.5}
                  value={
                    vm.layoutDoors.find((door) => door.id === vm.activeDoorId)?.pos ?? 0
                  }
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
                  value={
                    vm.layoutDoors.find((door) => door.id === vm.activeDoorId)?.width ?? 1.2
                  }
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
                  value={
                    vm.layoutDoors.find((door) => door.id === vm.activeDoorId)?.height ?? 2.2
                  }
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
          <p className="theater-layout-hint">
            На плане (вкладка «План»): перетаскивайте двери на стенах; кружки — ширина
            проёма. Можно добавить несколько дверей на разные стены.
          </p>
      </TheaterCollapsibleSection>
    </>
  );
}
