import cn from "classnames";
import { useMemo, useState } from "react";
import {
  countSceneOutlinerItems,
  filterSceneOutlinerGroups,
  isSceneOutlinerItemActive,
  resolveSceneOutlinerGroupVisibility,
  sceneOutlinerKindTypeClass,
  type SceneOutlinerGroup,
  type SceneOutlinerItem,
} from "../model/theater-scene-outliner";

export type TheaterSceneOutlinerProps = {
  groups: SceneOutlinerGroup[];
  activeSpotlightId?: number;
  activeModelId?: number;
  activeDoorId?: number;
  layoutFocused?: boolean;
  audienceSeatsFocused?: boolean;
  stageGridFocused?: boolean;
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
  audienceSeatsFocused,
  stageGridFocused,
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
    <div className="theater-editor-scene">
      <div className="theater-editor-panel-heading">Сцена</div>
      <div className="theater-editor-outliner-toolbar">
        <input
          type="search"
          className="theater-editor-outliner-filter native-text-input"
          placeholder="Фильтр…"
          value={filter}
          disabled={disabled}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="theater-editor-outliner-count" title="Элементов на сцене">
          {filter.trim() ? `${visibleCount}/${totalCount}` : totalCount}
        </span>
      </div>
      {onShowHiddenChange ? (
        <label className="theater-editor-outliner-toggle">
          <input
            type="checkbox"
            checked={showHidden}
            disabled={disabled}
            onChange={(event) => onShowHiddenChange(event.target.checked)}
          />
          <span>Скрытые</span>
        </label>
      ) : null}
      {onRevealAllHidden || onIsolateSelection ? (
        <div className="theater-editor-outliner-actions">
          {onRevealAllHidden ? (
            <button
              type="button"
              className="theater-editor-outliner-action"
              disabled={disabled}
              onClick={onRevealAllHidden}
            >
              Показать все
            </button>
          ) : null}
          {onIsolateSelection ? (
            <button
              type="button"
              className="theater-editor-outliner-action"
              disabled={disabled}
              title="Скрыть всё, кроме выбранного"
              onClick={onIsolateSelection}
            >
              Изолировать
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className="theater-editor-outliner-listbox"
        role="listbox"
        aria-label="Элементы сцены"
      >
        {filteredGroups.length === 0 ? (
          <p className="theater-editor-outliner-empty">Ничего не найдено</p>
        ) : (
          filteredGroups.map((group) => {
            const isCollapsed = collapsed[group.id] ?? false;
            const groupVisibility = resolveSceneOutlinerGroupVisibility(group);
            return (
              <section key={group.id} className="theater-editor-outliner-group">
                <div className="theater-editor-outliner-group-head">
                  <button
                    type="button"
                    className="theater-editor-outliner-option theater-editor-outliner-option--group"
                    disabled={disabled}
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [group.id]: !isCollapsed,
                      }))
                    }
                  >
                    <span
                      className={[
                        "theater-editor-outliner-opener",
                        isCollapsed ? "theater-editor-outliner-opener--closed" : "theater-editor-outliner-opener--open",
                      ].join(" ")}
                      aria-hidden
                    />
                    <span className="theater-editor-outliner-type Group" aria-hidden />
                    <span className="theater-editor-outliner-name">
                      {group.title}
                    </span>
                    <span className="theater-editor-outliner-meta">
                      {group.items.length}
                    </span>
                  </button>
                  {groupVisibility.hideableCount > 0 && onToggleGroupVisibility ? (
                    <button
                      type="button"
                      className="theater-editor-outliner-visibility"
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
                      {groupVisibility.allHidden ? "◌" : "◉"}
                    </button>
                  ) : null}
                </div>
                {!isCollapsed
                  ? group.items.map((item) => {
                      const active = isSceneOutlinerItemActive(item, {
                        spotlightId: activeSpotlightId,
                        modelId: activeModelId,
                        doorId: activeDoorId,
                        layoutFocused,
                        audienceSeatsFocused,
                        stageGridFocused,
                      });
                      const pulsing =
                        pulseTarget?.kind === item.kind && pulseTarget.id === item.id;
                      const typeClass = sceneOutlinerKindTypeClass(item.kind);
                      return (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className={cn(
                            "theater-editor-outliner-row",
                            pulsing && "theater-editor-outliner-row--pulse",
                          )}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={cn(
                              "theater-editor-outliner-option",
                              "theater-editor-outliner-option--child",
                              active && "theater-editor-outliner-option--active",
                              item.muted && "theater-editor-outliner-option--muted",
                            )}
                            disabled={disabled}
                            title={
                              item.meta ? `${item.label} · ${item.meta}` : item.label
                            }
                            onClick={(event) => onFocusItem(item, event.shiftKey)}
                            onDoubleClick={() => onFocusItem(item, false)}
                          >
                            <span className="theater-editor-outliner-spacer" aria-hidden />
                            <span
                              className={cn("theater-editor-outliner-type", typeClass)}
                              aria-hidden
                            />
                            <span className="theater-editor-outliner-name">
                              {item.label}
                            </span>
                            {item.meta ? (
                              <span className="theater-editor-outliner-meta">
                                {item.meta}
                              </span>
                            ) : null}
                          </button>
                          {item.canHide && onToggleVisibility ? (
                            <button
                              type="button"
                              className="theater-editor-outliner-visibility"
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
                      );
                    })
                  : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
