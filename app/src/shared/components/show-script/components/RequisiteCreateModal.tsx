import cn from "classnames";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CustomSelect, type CustomSelectOption } from "../../../core/custom-select/CustomSelect";
import { Modal } from "../../../core/modal/Modal";
import { MiniAvatar } from "../../mini-avatar/MiniAvatar";
import {
  PersonSelectPreview,
  type PersonSelectProfile,
} from "../../person-select/PersonSelectPreview";
import type { ScriptRequisiteDuty } from "../../../types/script";
import { RequisitePropAvatar } from "./RequisitePropAvatar";
import "./requisite-create-modal.css";

export type RequisiteCreateAssigneeOption = CustomSelectOption & {
  person?: PersonSelectProfile;
};

const DUTY_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "Не выбрано", searchText: "не выбрано" },
  { value: "setup", label: "Занести" },
  { value: "strike", label: "Унести" },
  { value: "use", label: "Манипуляции" },
];

export type RequisiteCreatePayload = {
  label: string;
  duty: ScriptRequisiteDuty | null;
  assigneeEmail: string | null;
  placeNote: string;
  actionNote: string;
  avatarKey: string | null;
  includeInKadr: boolean;
};

type RequisiteCreateModalProps = {
  isOpen: boolean;
  assigneeOptions: RequisiteCreateAssigneeOption[];
  accessToken: string | null | undefined;
  projectSlug: string;
  showKadrCue?: boolean;
  onClose: () => void;
  onSubmit: (payload: RequisiteCreatePayload) => void;
};

function normalizeAssigneeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function RequisiteCreateModal({
  isOpen,
  assigneeOptions,
  accessToken,
  projectSlug,
  showKadrCue = false,
  onClose,
  onSubmit,
}: RequisiteCreateModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const [label, setLabel] = useState("");
  const [duty, setDuty] = useState("");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [placeNote, setPlaceNote] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [includeInKadr, setIncludeInKadr] = useState(true);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setLabel("");
      setDuty("");
      setAssigneeEmail("");
      setPlaceNote("");
      setActionNote("");
      setAvatarKey(null);
      setIncludeInKadr(true);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const assigneeOptionsWithEmpty = [
    { value: "", label: "Не назначен", searchText: "не назначен" },
    ...assigneeOptions,
  ];

  const personByEmail = new Map<string, PersonSelectProfile>();
  for (const option of assigneeOptions) {
    if (!option.person?.email) continue;
    personByEmail.set(normalizeAssigneeKey(option.person.email), option.person);
  }

  const assigneeKey = normalizeAssigneeKey(assigneeEmail);
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
    String(assigneePerson?.profile?.avatarUrl ?? "").trim() || null;

  const canSubmit = Boolean(label.trim());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextLabel = label.trim();
    if (!nextLabel) return;
    onSubmit({
      label: nextLabel,
      duty: duty ? (duty as ScriptRequisiteDuty) : null,
      assigneeEmail: assigneeEmail.trim() || null,
      placeNote: placeNote.trim(),
      actionNote: actionNote.trim(),
      avatarKey,
      includeInKadr: showKadrCue ? includeInKadr : false,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="requisite-create-modal__panel"
      ariaLabelledBy={titleId}
    >
      <form className="requisite-create-modal" onSubmit={handleSubmit}>
        <header className="requisite-create-modal__header">
          <h2 id={titleId} className="requisite-create-modal__title">
            Новый реквизит
          </h2>
        </header>

        <div className="requisite-create-modal__body">
          <div className="requisite-create-modal__avatar-row">
            <RequisitePropAvatar
              label={label.trim() || "Реквизит"}
              avatarKey={avatarKey ?? undefined}
              isEditing
              accessToken={accessToken}
              projectSlug={projectSlug}
              onAvatarKeyChange={setAvatarKey}
            />
            <label className="requisite-create-modal__field" htmlFor={`${titleId}-label`}>
              <span className="requisite-create-modal__label">Название</span>
              <input
                ref={inputRef}
                id={`${titleId}-label`}
                className="requisite-create-modal__input native-text-input"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Название реквизита"
                maxLength={120}
              />
            </label>
          </div>

          <label className="requisite-create-modal__field">
            <span className="requisite-create-modal__label">Действие</span>
            <CustomSelect
              value={duty}
              options={DUTY_OPTIONS}
              onChange={setDuty}
              placeholder="Действие"
              searchable={false}
              triggerClassName="requisite-create-modal__select"
              aria-label="Действие с реквизитом"
            />
          </label>

          {duty === "setup" ? (
            <label className="requisite-create-modal__field" htmlFor={`${titleId}-place`}>
              <span className="requisite-create-modal__label">Куда ставить</span>
              <input
                id={`${titleId}-place`}
                className="requisite-create-modal__input native-text-input"
                value={placeNote}
                onChange={(event) => setPlaceNote(event.target.value)}
                placeholder="Место на сцене"
              />
            </label>
          ) : null}

          {duty === "use" ? (
            <label className="requisite-create-modal__field" htmlFor={`${titleId}-action`}>
              <span className="requisite-create-modal__label">Что сделать</span>
              <input
                id={`${titleId}-action`}
                className="requisite-create-modal__input native-text-input"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="Описание манипуляции"
              />
            </label>
          ) : null}

          <label className="requisite-create-modal__field">
            <span className="requisite-create-modal__label">Ответственный</span>
            <CustomSelect
              className="requisite-create-modal__assignee"
              triggerClassName="requisite-create-modal__assignee-trigger"
              value={assigneeEmail}
              options={assigneeOptionsWithEmpty}
              onChange={setAssigneeEmail}
              placeholder="Не назначен"
              searchPlaceholder="Поиск по театру"
              noOptionsLabel="Нет участников"
              minOptionsForSearch={1}
              aria-label="Ответственный"
              renderValue={() => (
                <span className="requisite-create-modal__assignee-value">
                  <MiniAvatar
                    src={assigneeAvatarUrl}
                    label={assigneeLabel}
                    title={assigneeLabel}
                  />
                  <span>{assigneeLabel}</span>
                </span>
              )}
              renderOption={(option) => {
                if (!option.value) {
                  return (
                    <span className="requisite-create-modal__assignee-clear">
                      {option.label}
                    </span>
                  );
                }
                const optionPerson =
                  personByEmail.get(normalizeAssigneeKey(option.value)) ?? {
                    email: option.value,
                    profile: null,
                  };
                return (
                  <PersonSelectPreview
                    person={optionPerson}
                    placeholder="Участник"
                    compact={false}
                  />
                );
              }}
            />
          </label>

          {showKadrCue ? (
            <label
              className={cn(
                "requisite-create-modal__check",
                includeInKadr && "requisite-create-modal__check--active",
              )}
            >
              <input
                type="checkbox"
                checked={includeInKadr}
                onChange={(event) => setIncludeInKadr(event.target.checked)}
              />
              <span>В эту картину</span>
            </label>
          ) : null}
        </div>

        <footer className="requisite-create-modal__actions">
          <button
            type="button"
            className="requisite-create-modal__btn"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={cn(
              "requisite-create-modal__btn",
              "requisite-create-modal__btn--primary",
            )}
            disabled={!canSubmit}
          >
            Добавить
          </button>
        </footer>
      </form>
    </Modal>
  );
}
