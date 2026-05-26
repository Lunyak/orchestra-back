import { THEATER_RECESS_WALL_LABELS } from "../../../model/theater-wall-recesses";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutRecessesSection({ vm }: LayoutSectionProps) {
  if ((vm.layout.stageShape ?? "rectangle") === "custom") return null;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-recesses"
        title="Ниши"
        summary="Углубления в стенах"
        badge={vm.layoutRecesses.length > 0 ? String(vm.layoutRecesses.length) : undefined}
      >
<div className="theater-door-list">
            {vm.layoutRecesses.map((recess) => (
              <TheaterBtn
                key={recess.id}
                active={recess.id === vm.activeRecessId}
                onClick={() => vm.setActiveRecessId(recess.id)}
                title={`${THEATER_RECESS_WALL_LABELS[recess.wall]} · ${recess.width}×${recess.depth} м`}
              >
                #{recess.id} {THEATER_RECESS_WALL_LABELS[recess.wall]}
              </TheaterBtn>
            ))}
          </div>
          <div className="theater-btn-row theater-btn-row--3">
            <TheaterBtn onClick={() => vm.addWallRecess("left")}>+ Левая ниша</TheaterBtn>
            <TheaterBtn onClick={() => vm.addWallRecess("right")}>+ Правая</TheaterBtn>
            <TheaterBtn onClick={() => vm.addWallRecess("back")}>+ Задняя</TheaterBtn>
            <TheaterBtn
              onClick={vm.removeActiveWallRecess}
              disabled={vm.layoutRecesses.length === 0 || vm.activeRecessId == null}
            >
              Удалить
            </TheaterBtn>
          </div>
          {vm.activeRecessId != null ? (
            <div className="theater-layout-grid">
              <TheaterField label="Стена">
                <select
                  className="native-text-input"
                  value={
                    vm.layoutRecesses.find((item) => item.id === vm.activeRecessId)?.wall ?? "left"
                  }
                  onChange={(event) =>
                    vm.updateActiveWallRecess({
                      wall: event.target.value as "left" | "right" | "back",
                    })
                  }
                >
                  <option value="left">Левая</option>
                  <option value="right">Правая</option>
                  <option value="back">Задняя</option>
                </select>
              </TheaterField>
              <TheaterField label={labelM("Позиция")}>
                <input
                  type="number"
                  className="native-text-input"
                  step={0.5}
                  value={vm.layoutRecesses.find((item) => item.id === vm.activeRecessId)?.pos ?? 0}
                  onFocus={vm.beginTheaterHistoryTransaction}
                  onBlur={vm.endTheaterHistoryTransaction}
                  onChange={(event) =>
                    vm.updateActiveWallRecess({ pos: Number(event.target.value) || 0 })
                  }
                />
              </TheaterField>
              <TheaterField label={labelM("Длина")}>
                <input
                  type="number"
                  className="native-text-input"
                  min={0.6}
                  max={4}
                  step={0.1}
                  value={vm.layoutRecesses.find((item) => item.id === vm.activeRecessId)?.width ?? 1.5}
                  onFocus={vm.beginTheaterHistoryTransaction}
                  onBlur={vm.endTheaterHistoryTransaction}
                  onChange={(event) =>
                    vm.updateActiveWallRecess({
                      width: Math.max(0.6, Number(event.target.value) || 1.5),
                    })
                  }
                />
              </TheaterField>
              <TheaterField label={labelM("Глубина")}>
                <input
                  type="number"
                  className="native-text-input"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={vm.layoutRecesses.find((item) => item.id === vm.activeRecessId)?.depth ?? 0.8}
                  onFocus={vm.beginTheaterHistoryTransaction}
                  onBlur={vm.endTheaterHistoryTransaction}
                  onChange={(event) =>
                    vm.updateActiveWallRecess({
                      depth: Math.max(0.3, Number(event.target.value) || 0.8),
                    })
                  }
                />
              </TheaterField>
            </div>
          ) : null}
          
      </TheaterCollapsibleSection>
    </>
  );
}
