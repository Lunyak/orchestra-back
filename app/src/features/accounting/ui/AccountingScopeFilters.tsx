import type { AccountingScopes } from "../../../sync/api/accounting";
import type {
  AccountingTab,
  TroupeOption,
} from "../model/accounting-page-types";

type AccountingScopeFiltersProps = {
  resolvedTab: AccountingTab | null;
  scopes: AccountingScopes;
  entityId: string;
  troupeId: string;
  theaterTroupeOptions: TroupeOption[];
  projectTroupeOptions: TroupeOption[];
  onEntityChange: (entityId: string) => void;
  onTroupeChange: (troupeId: string) => void;
};

export function AccountingScopeFilters({
  resolvedTab,
  scopes,
  entityId,
  troupeId,
  theaterTroupeOptions,
  projectTroupeOptions,
  onEntityChange,
  onTroupeChange,
}: AccountingScopeFiltersProps) {
  if (resolvedTab === "theaters" && scopes.theaters.length > 0) {
    return (
      <div className="accounting-scope-row">
        <label className="accounting-scope-row__field">
          <span>Театр</span>
          <select
            value={entityId}
            onChange={(event) => onEntityChange(event.target.value)}
          >
            {scopes.theaters.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.title}
              </option>
            ))}
          </select>
        </label>
        <label className="accounting-scope-row__field">
          <span>Труппа</span>
          <select
            value={troupeId}
            onChange={(event) => onTroupeChange(event.target.value)}
          >
            {theaterTroupeOptions.map((troupe) => (
              <option key={troupe.id} value={troupe.id}>
                {troupe.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (resolvedTab === "studios" && scopes.studios.length > 0) {
    return (
      <div className="accounting-scope-row">
        <label className="accounting-scope-row__field">
          <span>Студия</span>
          <select
            value={entityId}
            onChange={(event) => onEntityChange(event.target.value)}
          >
            {scopes.studios.map((studio) => (
              <option key={studio.id} value={studio.id}>
                {studio.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (resolvedTab === "projects" && scopes.projects.length > 0) {
    return (
      <div className="accounting-scope-row">
        <label className="accounting-scope-row__field">
          <span>Проект</span>
          <select
            value={entityId}
            onChange={(event) => onEntityChange(event.target.value)}
          >
            {scopes.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="accounting-scope-row__field">
          <span>Труппа</span>
          <select
            value={troupeId}
            onChange={(event) => onTroupeChange(event.target.value)}
          >
            {projectTroupeOptions.map((troupe) => (
              <option key={troupe.id} value={troupe.id}>
                {troupe.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return null;
}
