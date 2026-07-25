import cn from "classnames";
import { THEATER_RECESS_WALL_LABELS } from "../../../model/theater-wall-recesses";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutRecessesSection({ vm }: LayoutSectionProps) {
  if ((vm.layout.stageShape ?? "rectangle") === "custom") return null;

  const activeRecess = vm.layoutRecesses.find(
    (item) => item.id === vm.activeRecessId,
  );

  return (
    <TheaterCollapsibleSection
      sectionId="layout-recesses"
      title="Углубления в стенах"
      badge={
        vm.layoutRecesses.length > 0 ? String(vm.layoutRecesses.length) : undefined
      }
      className="theater-panel-section--compact-labels"
      headerActions={
        <TheaterBtn
          onClick={() => vm.addWallRecess("left")}
          title="Добавить углубление слева"
        >
          +
        </TheaterBtn>
      }
    >
      <div className="theater-spotlight-list theater-spotlight-list--scroll theater-door-list--rows">
        {vm.layoutRecesses.map((recess) => {
          const isSelected = recess.id === vm.activeRecessId;
          const label = `${THEATER_RECESS_WALL_LABELS[recess.wall]} · ${recess.width}×${recess.depth}`;
          return (
            <div
              key={recess.id}
              className={cn("theater-spotlight-tab", "theater-spotlight-tab--door")}
            >
              <button
                type="button"
                className={cn(
                  "theater-door-list__name",
                  isSelected && "theater-door-list__name--active",
                )}
                title={label}
                onClick={() => vm.setActiveRecessId(recess.id)}
              >
                {label}
              </button>
              <TheaterBtn
                className="theater-btn--danger"
                title="Удалить углубление"
                onClick={() => vm.removeActiveWallRecess(recess.id)}
              >
                ×
              </TheaterBtn>
            </div>
          );
        })}
        {vm.layoutRecesses.length === 0 ? (
          <span className="theater-spotlight-empty">Углублений нет</span>
        ) : null}
      </div>

      <div className="theater-btn-row theater-btn-row--3">
        <TheaterBtn onClick={() => vm.addWallRecess("left")}>+ Левая</TheaterBtn>
        <TheaterBtn onClick={() => vm.addWallRecess("right")}>+ Правая</TheaterBtn>
        <TheaterBtn onClick={() => vm.addWallRecess("back")}>+ Задняя</TheaterBtn>
      </div>

      {activeRecess ? (
        <div className="theater-layout-grid">
          <TheaterField label="Стена">
            <select
              className="native-text-input"
              value={activeRecess.wall}
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
              value={activeRecess.pos}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateActiveWallRecess({
                  pos: Number(event.target.value) || 0,
                })
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
              value={activeRecess.width}
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
              value={activeRecess.depth}
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
  );
}
