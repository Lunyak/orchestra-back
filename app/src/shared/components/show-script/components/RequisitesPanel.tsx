import cn from "classnames";
import React from "react";
import { CustomSelect, type CustomSelectOption } from "../../../core/custom-select/CustomSelect";
import { MiniAvatar } from "../../mini-avatar/MiniAvatar";
import type { ScriptRequisite, ScriptRequisiteDuty } from "../../../types/script";
import {
  PersonSelectPreview,
  type PersonSelectProfile,
} from "../../person-select/PersonSelectPreview";
import { RequisitePropAvatar } from "./RequisitePropAvatar";

export type TheaterRequisiteCandidate = {
  id: number;
  name: string;
};

export type RequisiteAssigneeOption = CustomSelectOption & {
  person?: PersonSelectProfile;
};

const DUTY_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "Не выбрано", searchText: "не выбрано" },
  { value: "setup", label: "Занести" },
  { value: "strike", label: "Унести" },
  { value: "use", label: "Манипуляции" },
];

type RequisiteSectionId = "unassigned" | ScriptRequisiteDuty;

const SECTIONS: Array<{ id: RequisiteSectionId; title: string }> = [
  { id: "unassigned", title: "Не назначен" },
  { id: "setup", title: "Занести" },
  { id: "strike", title: "Унести" },
  { id: "use", title: "Манипуляции" },
];

function normalizeAssigneeKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveAssigneeValue(
  raw: string | undefined,
  options: RequisiteAssigneeOption[],
): string {
  const key = normalizeAssigneeKey(String(raw ?? ""));
  if (!key) return "";
  const byValue = options.find((option) => normalizeAssigneeKey(option.value) === key);
  if (byValue) return byValue.value;
  const byLabel = options.find((option) => normalizeAssigneeKey(option.label) === key);
  return byLabel?.value ?? raw ?? "";
}

function sectionIdForItem(item: ScriptRequisite): RequisiteSectionId {
  if (item.duty === "strike" || item.duty === "use" || item.duty === "setup") {
    return item.duty;
  }
  return "unassigned";
}

export function RequisitesPanel({
  show,
  isEditing,
  requisites,
  theaterCandidates = [],
  assigneeOptions = [],
  hasCopiedRequisites = false,
  newRequisite,
  setNewRequisite,
  onCopy,
  onPaste,
  onResetAll,
  onAdd,
  onAddFromTheater,
  onToggle,
  onRemove,
  onAssigneeChange,
  onDutyChange,
  onPlaceNoteChange,
  onActionNoteChange,
  onAvatarKeyChange,
  accessToken,
  projectSlug,
  hideBulkActions = false,
  hideCheckedToggle = false,
  hideHeader = false,
  theaterPickerOpen: theaterPickerOpenProp,
  onTheaterPickerOpenChange,
  renderItemExtra,
}: {
  show: boolean;
  isEditing: boolean;
  requisites: ScriptRequisite[];
  theaterCandidates?: TheaterRequisiteCandidate[];
  assigneeOptions?: RequisiteAssigneeOption[];
  hasCopiedRequisites?: boolean;
  newRequisite: string;
  setNewRequisite: React.Dispatch<React.SetStateAction<string>>;
  onCopy?: () => void;
  onPaste?: () => void;
  onResetAll?: () => void;
  onAdd: () => void;
  onAddFromTheater?: (theaterModelId: number) => void;
  onToggle?: (index: number) => void;
  onRemove: (index: number) => void;
  onAssigneeChange: (index: number, email: string | null) => void;
  onDutyChange: (index: number, duty: ScriptRequisiteDuty | null) => void;
  onPlaceNoteChange: (index: number, note: string) => void;
  onActionNoteChange: (index: number, note: string) => void;
  onAvatarKeyChange: (index: number, avatarKey: string | null) => void;
  accessToken: string | null | undefined;
  projectSlug: string;
  hideBulkActions?: boolean;
  hideCheckedToggle?: boolean;
  /** Header rendered by parent (e.g. collapsible title + 3D). */
  hideHeader?: boolean;
  theaterPickerOpen?: boolean;
  onTheaterPickerOpenChange?: (open: boolean) => void;
  renderItemExtra?: (item: ScriptRequisite, index: number) => React.ReactNode;
}) {
  const [theaterPickerOpenState, setTheaterPickerOpenState] = React.useState(false);
  const theaterPickerControlled = theaterPickerOpenProp !== undefined;
  const theaterPickerOpen = theaterPickerControlled
    ? theaterPickerOpenProp
    : theaterPickerOpenState;
  const setTheaterPickerOpen = (open: boolean) => {
    if (!theaterPickerControlled) setTheaterPickerOpenState(open);
    onTheaterPickerOpenChange?.(open);
  };
  const hasTheaterCandidates = theaterCandidates.length > 0;
  const canOpenTheaterPicker = isEditing && onAddFromTheater != null;

  const assigneeOptionsWithEmpty = React.useMemo(
    () => [
      { value: "", label: "Не назначен", searchText: "не назначен" },
      ...assigneeOptions,
    ],
    [assigneeOptions],
  );

  const personByEmail = React.useMemo(() => {
    const map = new Map<string, PersonSelectProfile>();
    for (const option of assigneeOptions) {
      if (!option.person?.email) continue;
      map.set(normalizeAssigneeKey(option.person.email), option.person);
    }
    return map;
  }, [assigneeOptions]);

  const indexedBySection = React.useMemo(() => {
    const groups: Record<RequisiteSectionId, Array<{ item: ScriptRequisite; index: number }>> = {
      unassigned: [],
      setup: [],
      strike: [],
      use: [],
    };
    requisites.forEach((item, index) => {
      groups[sectionIdForItem(item)].push({ item, index });
    });
    return groups;
  }, [requisites]);

  const renderAssigneePerson = (
    email: string | null | undefined,
    placeholder: string,
    compact: boolean,
  ) => {
    const key = normalizeAssigneeKey(String(email ?? ""));
    const person = key
      ? personByEmail.get(key) ?? { email: key, profile: null }
      : null;
    return (
      <PersonSelectPreview
        person={person}
        placeholder={placeholder}
        compact={compact}
      />
    );
  };

  if (!show) return null;

  return (
    <section className="requisites-panel">
      {!hideHeader ? (
        <div className="requisites-header">
          <div className="requisites-header-left">
            <span>Реквизит</span>
            <span className="requisites-count">{requisites.length}</span>
          </div>
          <div className="requisites-actions">
            {canOpenTheaterPicker ? (
              <button
                type="button"
                className={cn(
                  "requisites-action-btn",
                  "requisites-action-btn--theater",
                  theaterPickerOpen && "requisites-action-btn--active",
                )}
                onClick={() => setTheaterPickerOpen(!theaterPickerOpen)}
                title="Добавить из 3D"
              >
                3D
              </button>
            ) : null}
            {!hideBulkActions ? (
              <>
                <button
                  type="button"
                  className="requisites-action-btn"
                  onClick={onCopy}
                  disabled={requisites.length === 0 || onCopy == null}
                  title="Скопировать реквизит"
                >
                  С
                </button>
                <button
                  type="button"
                  className="requisites-action-btn"
                  onClick={onPaste}
                  disabled={!hasCopiedRequisites || onPaste == null}
                  title="Вставить реквизит"
                >
                  P
                </button>
                <button
                  type="button"
                  className="requisites-action-btn"
                  onClick={onResetAll}
                  disabled={requisites.length === 0 || onResetAll == null}
                  title="Сбросить отметки на всех сценах"
                >
                  D
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {isEditing && theaterPickerOpen ? (
        <div className="requisites-theater-picker">
          <div className="requisites-theater-picker__title">Из 3D театра</div>
          {!hasTheaterCandidates ? (
            <div className="requisites-theater-picker__empty">
              Нет помеченных моделей. В 3D включите «Реквизит» у объекта.
            </div>
          ) : (
            <ul className="requisites-theater-picker__list">
              {theaterCandidates.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="requisites-theater-picker__item"
                    onClick={() => onAddFromTheater?.(item.id)}
                  >
                    <span>{item.name}</span>
                    <span className="requisites-theater-picker__add">+</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {isEditing ? (
        <div className="requisites-add">
          <input
            type="text"
            value={newRequisite}
            onChange={(event) => setNewRequisite(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
            placeholder="Добавить реквизит"
          />
          <button type="button" onClick={onAdd}>
            +
          </button>
        </div>
      ) : null}

      <div className="requisites-list">
        {requisites.length === 0 ? (
          <div className="requisites-empty">Нет реквизита</div>
        ) : (
          SECTIONS.map((section) => {
            const rows = indexedBySection[section.id];
            if (rows.length === 0) return null;
            return (
              <section key={section.id} className="requisites-section">
                <h3 className="requisites-section__title">
                  <span>{section.title}</span>
                  <span className="requisites-section__count">{rows.length}</span>
                </h3>
                <div className="requisites-section__list">
                  {rows.map(({ item, index }) => {
                    const assigneeValue = resolveAssigneeValue(
                      item.assigneeEmail,
                      assigneeOptions,
                    );
                    const dutyValue =
                      item.duty === "strike" ||
                      item.duty === "use" ||
                      item.duty === "setup"
                        ? item.duty
                        : "";

                    const assigneeKey = normalizeAssigneeKey(assigneeValue);
                    const assigneePerson = assigneeKey
                      ? personByEmail.get(assigneeKey) ?? {
                          email: assigneeKey,
                          profile: null,
                        }
                      : null;
                    const assigneeOptionLabel = assigneeOptions.find(
                      (option) => normalizeAssigneeKey(option.value) === assigneeKey,
                    )?.label;
                    const assigneeLabel =
                      String(assigneeOptionLabel ?? "").trim() ||
                      assigneePerson?.email ||
                      "Не назначен";
                    const assigneeAvatarUrl =
                      String(assigneePerson?.profile?.avatarUrl ?? "").trim() ||
                      null;

                    return (
                      <div
                        key={`${item.id}-${index}`}
                        className={cn(
                          "requisite-item",
                          item.theaterModelId != null && "requisite-item--from-3d",
                        )}
                      >
                        <RequisitePropAvatar
                          label={item.label}
                          avatarKey={item.avatarKey}
                          isEditing={isEditing}
                          accessToken={accessToken}
                          projectSlug={projectSlug}
                          onAvatarKeyChange={(avatarKey) =>
                            onAvatarKeyChange(index, avatarKey)
                          }
                        />
                        <div className="requisite-item-body">
                          <div className="requisite-item-top">
                            <label className="requisite-item-main">
                              {!hideCheckedToggle && onToggle != null ? (
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={() => onToggle(index)}
                                />
                              ) : null}
                              <span>{item.label}</span>
                              {item.theaterModelId != null ? (
                                <span className="requisite-item-source">из 3D</span>
                              ) : null}
                            </label>
                            {isEditing ? (
                              <button
                                type="button"
                                className="requisite-remove"
                                onClick={() => onRemove(index)}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                          <div className="requisite-assignment">
                            <label className="requisite-assignee-field">
                              <span>Действие</span>
                              <CustomSelect
                                value={dutyValue}
                                options={DUTY_OPTIONS}
                                onChange={(value) =>
                                  onDutyChange(
                                    index,
                                    value
                                      ? (value as ScriptRequisiteDuty)
                                      : null,
                                  )
                                }
                                placeholder="Действие"
                                searchable={false}
                                triggerClassName="requisite-assignee-field__select"
                                aria-label="Действие с реквизитом"
                                disabled={!isEditing}
                              />
                            </label>
                            {dutyValue === "setup" ? (
                              <label className="requisite-note-field">
                                <span>Куда ставить</span>
                                <input
                                  type="text"
                                  className="requisite-note-field__input"
                                  value={item.placeNote ?? ""}
                                  placeholder="Место на сцене"
                                  disabled={!isEditing}
                                  onChange={(event) =>
                                    onPlaceNoteChange(index, event.target.value)
                                  }
                                />
                              </label>
                            ) : null}
                            {dutyValue === "use" ? (
                              <label className="requisite-note-field">
                                <span>Что сделать</span>
                                <input
                                  type="text"
                                  className="requisite-note-field__input"
                                  value={item.actionNote ?? ""}
                                  placeholder="Описание манипуляции"
                                  disabled={!isEditing}
                                  onChange={(event) =>
                                    onActionNoteChange(index, event.target.value)
                                  }
                                />
                              </label>
                            ) : null}
                            {renderItemExtra?.(item, index)}
                          </div>
                        </div>
                        <div className="requisite-item-avatar">
                          {isEditing ? (
                            <CustomSelect
                              className="requisite-assignee-avatar-select"
                              triggerClassName="requisite-assignee-avatar-select__trigger"
                              dropdownClassName="requisite-assignee-avatar-select__dropdown"
                              value={assigneeValue}
                              options={assigneeOptionsWithEmpty}
                              onChange={(value) =>
                                onAssigneeChange(index, value || null)
                              }
                              placeholder="Не назначен"
                              searchPlaceholder="Поиск по театру"
                              noOptionsLabel="Нет участников"
                              dropdownAlign="end"
                              dropdownMinWidth={280}
                              minOptionsForSearch={1}
                              aria-label="Ответственный"
                              renderValue={() => (
                                <MiniAvatar
                                  src={assigneeAvatarUrl}
                                  label={assigneeLabel}
                                  title={assigneeLabel}
                                />
                              )}
                              renderOption={(option) =>
                                option.value
                                  ? renderAssigneePerson(
                                      option.value,
                                      "Участник",
                                      false,
                                    )
                                  : (
                                    <span className="requisite-assignee-avatar-select__clear">
                                      {option.label}
                                    </span>
                                  )
                              }
                            />
                          ) : (
                            <MiniAvatar
                              src={assigneeAvatarUrl}
                              label={assigneeLabel}
                              title={assigneeLabel}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
