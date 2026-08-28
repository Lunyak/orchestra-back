import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { OptionalFilterSelect } from "@shared/core/optional-filter-select/OptionalFilterSelect";

type RoleFilterOption = { key: string; label: string };

type KanbanBoardToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  actorFilter: string;
  onActorFilterChange: (value: string) => void;
  onlyUnassigned: boolean;
  onOnlyUnassignedChange: (value: boolean) => void;
  roleFilterOptions: RoleFilterOption[];
  allActors: string[];
  formatActorList: (actors: string[]) => string;
  onReset: () => void;
};

export function KanbanBoardToolbar({
  query,
  onQueryChange,
  roleFilter,
  onRoleFilterChange,
  actorFilter,
  onActorFilterChange,
  onlyUnassigned,
  onOnlyUnassignedChange,
  roleFilterOptions,
  allActors,
  formatActorList,
  onReset,
}: KanbanBoardToolbarProps) {
  return (
    <div className="kanban-toolbar" aria-label="Фильтры доски">
      <label className="kanban-tool">
        <input
          value={query}
          onChange={(ev) => onQueryChange(ev.target.value)}
          placeholder="название / роль / исполнитель"
        />
      </label>

      <label className="kanban-tool">
        <OptionalFilterSelect
          value={roleFilter}
          onChange={onRoleFilterChange}
          placeholder="Роли"
          aria-label="Фильтр по роли"
        >
          {roleFilterOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </OptionalFilterSelect>
      </label>

      <label className="kanban-tool">
        <OptionalFilterSelect
          value={actorFilter}
          onChange={onActorFilterChange}
          placeholder="Актеры"
          aria-label="Фильтр по актеру"
        >
          {allActors.map((actor) => (
            <option key={actor} value={actor}>
              {formatActorList([actor])}
            </option>
          ))}
        </OptionalFilterSelect>
      </label>

      <LabeledCheckbox
        className="kanban-tool kanban-tool-check"
        checked={onlyUnassigned}
        onChange={onOnlyUnassignedChange}
      >
        без назначений
      </LabeledCheckbox>

      <Button type="button" className="primary kanban-btn-reset" onClick={onReset}>
        Сбросить
      </Button>
    </div>
  );
}
