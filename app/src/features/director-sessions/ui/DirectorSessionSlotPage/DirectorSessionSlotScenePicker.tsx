import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import type { ScriptScene } from "../../../../shared/types/script";
import { isReadyScene } from "../../model/session-page-utils";
import type { DirectorSessionSlotSelectableScene } from "../../model/useDirectorSessionSlotPage";
import type { DirectorSessionSlot } from "../../directorSessionsSync";
import { RehearsalsCard } from "../../../rehearsals-card/RehearsalsCard";

export type DirectorSessionSlotScenePickerProps = {
  slot: DirectorSessionSlot;
  projectFilter: string;
  onProjectFilterChange: (slug: string) => void;
  visibleProjects: string[];
  projectLabelBySlug: Map<string, string>;
  query: string;
  onQueryChange: (value: string) => void;
  onlySelectable: boolean;
  onOnlySelectableChange: (value: boolean) => void;
  membersLoading: boolean;
  rolesLoading: boolean;
  slotWindowLabel: { dateKey: string; range: string } | null;
  scenesLoading: boolean;
  scenesError: string | null;
  availabilityError: string | null;
  scenesForList: DirectorSessionSlotSelectableScene[];
  onSelectScene: (scene: ScriptScene) => void;
};

export function DirectorSessionSlotScenePicker({
  slot,
  projectFilter,
  onProjectFilterChange,
  visibleProjects,
  projectLabelBySlug,
  query,
  onQueryChange,
  onlySelectable,
  onOnlySelectableChange,
  membersLoading,
  rolesLoading,
  slotWindowLabel,
  scenesLoading,
  scenesError,
  availabilityError,
  scenesForList,
  onSelectScene,
}: DirectorSessionSlotScenePickerProps) {
  const availabilityBusy = membersLoading || rolesLoading;
  const scenesEmpty = scenesForList.length === 0 && !scenesLoading;
  const listScenes = scenesForList.slice(0, 250);

  return (
    <RehearsalsCard fluid title="Выбор сцены">
      <div className="director-session-slot-page__filters">
        <select
          className="native-select"
          value={projectFilter}
          onChange={(e) => onProjectFilterChange(e.target.value)}
        >
          {visibleProjects.map((slug) => (
            <option key={slug} value={slug}>
              {projectLabelBySlug.get(slug) ?? slug}
            </option>
          ))}
        </select>
        <input
          className={cn(
            "native-text-input",
            "director-session-slot-page__search-input",
          )}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="поиск по названию/тексту"
        />
      </div>

      <div className="director-session-slot-page__availability-bar">
        <label className="director-session-slot-page__availability-label">
          <input
            type="checkbox"
            checked={onlySelectable}
            onChange={(e) => onOnlySelectableChange(e.target.checked)}
          />
          <span className="director-session-slot-page__availability-label-text">
            по доступности актёров
          </span>
        </label>
        {availabilityBusy ? (
          <span className="director-session-slot-page__availability-hint">
            подгружаю роли/участников…
          </span>
        ) : null}
        {slotWindowLabel ? (
          <span className="director-session-slot-page__availability-hint">
            окно слота: <b>{slotWindowLabel.dateKey}</b> · {slotWindowLabel.range}
          </span>
        ) : (
          <span className="director-session-slot-page__availability-hint">
            нет даты/времени для расчёта доступности
          </span>
        )}
      </div>

      {scenesLoading ? (
        <PageLoader variant="view" label="Загружаю сцены…" />
      ) : null}
      {scenesError ? (
        <div className="settings-invite-error director-session-slot-page__error">
          {scenesError}
        </div>
      ) : null}
      {availabilityError ? (
        <div className="settings-invite-error director-session-slot-page__error">
          {availabilityError}
        </div>
      ) : null}

      <div className="director-session-slot-page__scene-list">
        {listScenes.map((item) => {
          const scene = item.scene;
          const isSelected = Boolean(
            slot.ref &&
              slot.ref.projectSlug === projectFilter &&
              slot.ref.sceneId === scene.id,
          );
          const sceneOk = item.ok;
          const durationLabel =
            scene.durationMin != null
              ? ` · длит.: ${Math.max(1, Math.floor(Number(scene.durationMin) || 1))} мин`
              : "";
          const statusLabel = isReadyScene(scene) ? "Готова" : "В работе";
          const missingPreview = item.missing.slice(0, 6).join(", ");
          const missingExtra =
            item.missing.length > 6 ? ` +${item.missing.length - 6}` : "";

          return (
            <button
              key={`${projectFilter}:${scene.id}`}
              type="button"
              className={cn(
                "director-session-slot-page__scene-item",
                sceneOk && "director-session-slot-page__scene-item--ok",
                isSelected &&
                  "director-session-slot-page__scene-item--selected",
              )}
              onClick={() => onSelectScene(scene)}
              title="Назначить в этот слот"
            >
              <div className="director-session-slot-page__scene-item-title">
                #{scene.id} {scene.title}
              </div>
              <div className="director-session-slot-page__scene-item-meta">
                {statusLabel}
                {durationLabel}
                {" · "}
                {sceneOk ? (
                  <span className="director-session-slot-page__scene-item-status--ok">
                    можно взять
                  </span>
                ) : (
                  <span className="director-session-slot-page__scene-item-status--bad">
                    не собирается
                  </span>
                )}
              </div>
              {!sceneOk && item.missing.length > 0 ? (
                <div className="director-session-slot-page__scene-item-missing">
                  не хватает: <b>{missingPreview}</b>
                  {missingExtra}
                </div>
              ) : null}
            </button>
          );
        })}
        {scenesEmpty ? (
          <div className="director-session-slot-page__empty">
            Нет сцен (или сценарий не найден).
          </div>
        ) : null}
      </div>
    </RehearsalsCard>
  );
}
