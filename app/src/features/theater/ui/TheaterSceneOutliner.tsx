import { useMemo, useState } from "react";
import {
  countSceneOutlinerItems,
  filterSceneOutlinerGroups,
  isSceneOutlinerItemActive,
  resolveSceneOutlinerGroupVisibility,
  type SceneOutlinerGroup,
  type SceneOutlinerItem,
} from "../model/theater-scene-outliner";

export type TheaterSceneOutlinerProps = {
  groups: SceneOutlinerGroup[];
  activeSpotlightId?: number;
  activeModelId?: number;
  activeDoorId?: number;
  layoutFocused?: boolean;
  pulseTarget?: { kind: SceneOutlinerItem["kind"]; id: number } | null;
  disabled?: boolean;
  showHidden?: boolean;
  onShowHiddenChange?: (value: boolean) => void;
  onRevealAllHidden?: () => void;
  onIsolateSelection?: () => void;
  onFocusItem: (item: SceneOutlinerItem, additive?: boolean) => void;
  onToggleVisibility?: (item: SceneOutlinerItem) => void;
  onToggleGroupVisibility?: (groupId: string, visible: boolean) => void;
};

export function TheaterSceneOutliner({
  groups,
  activeSpotlightId,
  activeModelId,
  activeDoorId,
  layoutFocused,
  pulseTarget,
  disabled,
  showHidden = true,
  onShowHiddenChange,
  onRevealAllHidden,
  onIsolateSelection,
  onFocusItem,
  onToggleVisibility,
  onToggleGroupVisibility,
}: TheaterSceneOutlinerProps) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredGroups = useMemo(
    () => filterSceneOutlinerGroups(groups, filter, { hideHidden: !showHidden }),
    [filter, groups, showHidden],
  );
  const totalCount = countSceneOutlinerItems(groups);
  const visibleCount = countSceneOutlinerItems(filteredGroups);

  return (
    <div className="theater-scene-outliner">
      <div className="theater-scene-outliner-header">
        <span>Элементы сцены</span>
        <span className="theater-scene-outliner-count">
          {filter.trim() ? `${visibleCount}/${totalCount}` : totalCount}
        </span>
      </div>
      <input
        type="search"
        className="theater-scene-outliner-filter native-text-input"
        placeholder="Поиск по названию…"
        value={filter}
        disabled={disabled}
        onChange={(event) => setFilter(event.target.value)}
      />
      {onShowHiddenChange ? (
        <label className="theater-scene-outliner-hidden-toggle">
          <input
            type="checkbox"
            checked={showHidden}
            disabled={disabled}
            onChange={(event) => onShowHiddenChange(event.target.checked)}
          />
          <span>Показывать скрытые</span>
        </label>
      ) : null}
      {onRevealAllHidden || onIsolateSelection ? (
        <div className="theater-scene-outliner-actions">
          {onRevealAllHidden ? (
            <button
              type="button"
              className="theater-scene-outliner-action"
              disabled={disabled}
              onClick={onRevealAllHidden}
            >
              Показать все
            </button>
          ) : null}
          {onIsolateSelection ? (
            <button
              type="button"
              className="theater-scene-outliner-action"
              disabled={disabled}
              title="Скрыть всё, кроме выбранного"
              onClick={onIsolateSelection}
            >
              Изолировать
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="theater-scene-outliner-groups">
        {filteredGroups.length === 0 ? (
          <p className="theater-scene-outliner-empty">Ничего не найдено</p>
        ) : (
          filteredGroups.map((group) => {
            const isCollapsed = collapsed[group.id] ?? false;
            const groupVisibility = resolveSceneOutlinerGroupVisibility(group);
            return (
              <section key={group.id} className="theater-scene-outliner-group">
                <div className="theater-scene-outliner-group-head">
                  <button
                    type="button"
                    className="theater-scene-outliner-group-toggle"
                    disabled={disabled}
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [group.id]: !isCollapsed,
                      }))
                    }
                  >
                    <span>{isCollapsed ? "▸" : "▾"}</span>
                    <span>
                      {group.title} ({group.items.length})
                    </span>
                  </button>
                  {groupVisibility.hideableCount > 0 && onToggleGroupVisibility ? (
                    <button
                      type="button"
                      className="theater-scene-outliner-group-visibility"
                      disabled={disabled}
                      title={
                        groupVisibility.allHidden
                          ? "Показать всю группу в 3D"
                          : "Скрыть всю группу в 3D"
                      }
                      onClick={() =>
                        onToggleGroupVisibility(group.id, groupVisibility.allHidden)
                      }
                    >
                      {groupVisibility.allHidden ? "Показать" : "Скрыть"}
                    </button>
                  ) : null}
                </div>
                {!isCollapsed ? (
                  <ul className="theater-scene-outliner-list">
                    {group.items.map((item) => {
                      const active = isSceneOutlinerItemActive(item, {
                        spotlightId: activeSpotlightId,
                        modelId: activeModelId,
                        doorId: activeDoorId,
                        layoutFocused,
                      });
                      const pulsing =
                        pulseTarget?.kind === item.kind && pulseTarget.id === item.id;
                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <div
                            className={[
                              "theater-scene-outliner-row",
                              pulsing ? "theater-scene-outliner-row--pulse" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <button
                              type="button"
                              className={[
                                "theater-scene-outliner-item",
                                active ? "theater-scene-outliner-item--active" : "",
                                item.muted ? "theater-scene-outliner-item--muted" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              disabled={disabled}
                              title={
                                item.meta ? `${item.label} · ${item.meta}` : item.label
                              }
                              onClick={(event) => onFocusItem(item, event.shiftKey)}
                            >
                              <span className="theater-scene-outliner-item-label">
                                {item.label}
                              </span>
                              {item.meta ? (
                                <span className="theater-scene-outliner-item-meta">
                                  {item.meta}
                                </span>
                              ) : null}
                            </button>
                            {item.canHide && onToggleVisibility ? (
                              <button
                                type="button"
                                className="theater-scene-outliner-visibility"
                                disabled={disabled}
                                title={item.hidden ? "Показать в 3D" : "Скрыть в 3D"}
                                aria-label={item.hidden ? "Показать" : "Скрыть"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleVisibility(item);
                                }}
                              >
                                {item.hidden ? "◌" : "◉"}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
