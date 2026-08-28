import cn from "classnames";
import { Button } from "../../../shared/core/button/Button";
import { LabeledToggle } from "../../../shared/core/labeled-toggle/LabeledToggle";
import {
  formatAliasesInput,
  type RoleMarkerEntry,
} from "../model/role-marker-entries";

export type FormatPlayTextRoleMarkersSectionProps = {
  markersFieldId: string;
  customRoleFieldId: string;
  useRoleMarkers: boolean;
  setUseRoleMarkers: (value: boolean) => void;
  useRoleAliases: boolean;
  setUseRoleAliases: (value: boolean) => void;
  castListDetected: boolean;
  hasSourceText: boolean;
  roleEntries: RoleMarkerEntry[];
  enabledRoleCount: number;
  aliasDrafts: Record<string, string>;
  customRoleDraft: string;
  setCustomRoleDraft: (value: string) => void;
  editingNameId: string | null;
  nameEditDraft: string;
  setNameEditDraft: (value: string) => void;
  refreshDetectedRoles: () => void;
  setAllRolesEnabled: (enabled: boolean) => void;
  toggleRoleEntry: (id: string, enabled: boolean) => void;
  handleAliasChange: (id: string, raw: string) => void;
  handleAliasBlur: () => void;
  startNameEdit: (entry: RoleMarkerEntry) => void;
  cancelNameEdit: () => void;
  saveNameEdit: () => void;
  addCustomRole: () => void;
};

export function FormatPlayTextRoleMarkersSection({
  markersFieldId,
  customRoleFieldId,
  useRoleMarkers,
  setUseRoleMarkers,
  useRoleAliases,
  setUseRoleAliases,
  castListDetected,
  hasSourceText,
  roleEntries,
  enabledRoleCount,
  aliasDrafts,
  customRoleDraft,
  setCustomRoleDraft,
  editingNameId,
  nameEditDraft,
  setNameEditDraft,
  refreshDetectedRoles,
  setAllRolesEnabled,
  toggleRoleEntry,
  handleAliasChange,
  handleAliasBlur,
  startNameEdit,
  cancelNameEdit,
  saveNameEdit,
  addCustomRole,
}: FormatPlayTextRoleMarkersSectionProps) {
  const hasRoles = roleEntries.length > 0;
  const markersToolbarDisabled = !useRoleMarkers || !hasRoles;
  const emptyRolesHint = castListDetected
    ? "Роли не распознаны — проверь строки под «Действующие лица» или добавь вручную."
    : "Нет списка персонажей — добавь заголовок «Действующие лица» в текст или роли вручную.";

  return (
    <div className="format-play-text-modal__markers">
      <div className="format-play-text-modal__markers-head">
        <LabeledToggle
          id={markersFieldId}
          checked={useRoleMarkers}
          onChange={setUseRoleMarkers}
        >
          Расставить роли в тексте
        </LabeledToggle>
        <LabeledToggle
          checked={useRoleAliases}
          disabled={!useRoleMarkers}
          onChange={setUseRoleAliases}
        >
          Псевдонимы
        </LabeledToggle>
      </div>
      <p className="format-play-text-modal__markers-hint">
        Список из блока <strong>«Действующие лица»</strong>. Включи «Псевдонимы», если в репликах
        короткие имена
      </p>
      {!castListDetected && hasSourceText ? (
        <p className="format-play-text-modal__markers-empty format-play-text-modal__markers-empty--warn">
          Блок «Действующие лица» не найден или пуст — включи «Форматировать „Действующие лица“»
          и проверь заголовок в тексте.
        </p>
      ) : null}

      <div className="format-play-text-modal__markers-toolbar">
        <button
          type="button"
          className="format-play-text-modal__markers-action"
          disabled={markersToolbarDisabled}
          onClick={() => setAllRolesEnabled(true)}
        >
          Выбрать все
        </button>
        <button
          type="button"
          className="format-play-text-modal__markers-action"
          disabled={markersToolbarDisabled}
          onClick={() => setAllRolesEnabled(false)}
        >
          Убрать все
        </button>
        <button
          type="button"
          className="format-play-text-modal__markers-action"
          disabled={!hasSourceText}
          onClick={refreshDetectedRoles}
        >
          Обновить из «Действующие лица»
        </button>
        <span className="format-play-text-modal__markers-count">
          {enabledRoleCount} из {roleEntries.length}
        </span>
      </div>

      {hasRoles ? (
        <div
          className={cn(
            "format-play-text-modal__markers-list",
            !useRoleMarkers && "format-play-text-modal__markers-list--disabled",
          )}
        >
          {roleEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "format-play-text-modal__role-card",
                !useRoleAliases && "format-play-text-modal__role-card--no-aliases",
              )}
            >
              <LabeledToggle
                className="format-play-text-modal__markers-item"
                checked={entry.enabled}
                disabled={!useRoleMarkers}
                onChange={(checked) => toggleRoleEntry(entry.id, checked)}
              >
                {editingNameId === entry.id ? (
                  <input
                    type="text"
                    className="format-play-text-modal__role-name-input native-text-input"
                    value={nameEditDraft}
                    disabled={!useRoleMarkers}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setNameEditDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveNameEdit();
                      }
                      if (event.key === "Escape") {
                        cancelNameEdit();
                      }
                    }}
                    onBlur={saveNameEdit}
                  />
                ) : (
                  <button
                    type="button"
                    className="format-play-text-modal__markers-name format-play-text-modal__markers-name--btn"
                    disabled={!useRoleMarkers}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startNameEdit(entry);
                    }}
                  >
                    {entry.name}
                  </button>
                )}
                {entry.isCustom ? (
                  <span className="format-play-text-modal__markers-tag">своё</span>
                ) : null}
              </LabeledToggle>
              {useRoleAliases ? (
                <input
                  type="text"
                  className="format-play-text-modal__role-aliases native-text-input"
                  value={aliasDrafts[entry.id] ?? formatAliasesInput(entry.aliases)}
                  disabled={!useRoleMarkers}
                  placeholder="псевдонимы: Ремонтный, Гусь"
                  onChange={(event) => handleAliasChange(entry.id, event.target.value)}
                  onBlur={handleAliasBlur}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="format-play-text-modal__markers-empty">{emptyRolesHint}</p>
      )}

      <div className="format-play-text-modal__markers-add">
        <label className="visually-hidden" htmlFor={customRoleFieldId}>
          Добавить роль
        </label>
        <input
          id={customRoleFieldId}
          type="text"
          className="format-play-text-modal__markers-add-input native-text-input"
          value={customRoleDraft}
          disabled={!useRoleMarkers}
          placeholder="Своя роль, например: Старый патриций"
          onChange={(event) => setCustomRoleDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addCustomRole();
          }}
        />
        <Button
          variant="secondary"
          disabled={!useRoleMarkers || !customRoleDraft.trim()}
          onClick={addCustomRole}
        >
          Добавить
        </Button>
      </div>
    </div>
  );
}
