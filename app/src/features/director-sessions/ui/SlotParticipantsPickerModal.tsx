import { MiniAvatar } from "@shared/components/mini-avatar/MiniAvatar";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import { useEffect, useMemo, useState } from "react";
import { profileListAvatarSrc } from "../../../sync/api/profile";
import type { TroupeMemberItem } from "../../../sync/api/troupe";
import { normalizeEmail } from "../model/session-page-utils";
import "./slot-participants-picker-modal.css";

function memberLabel(member: TroupeMemberItem) {
  const profileName =
    String(member.profile?.displayName ?? "").trim() ||
    [member.profile?.firstName, member.profile?.lastName]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");
  return profileName || member.email;
}

export type SlotParticipantsPickerModalProps = {
  isOpen: boolean;
  members: TroupeMemberItem[];
  selectedEmails: string[];
  onClose: () => void;
  onApply: (emails: string[]) => void;
};

export function SlotParticipantsPickerModal({
  isOpen,
  members,
  selectedEmails,
  onClose,
  onApply,
}: SlotParticipantsPickerModalProps) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDraft(new Set(selectedEmails.map((email) => normalizeEmail(email)).filter(Boolean)));
    setQuery("");
  }, [isOpen, selectedEmails]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const label = memberLabel(member).toLowerCase();
      const email = normalizeEmail(member.email).toLowerCase();
      return label.includes(needle) || email.includes(needle);
    });
  }, [members, query]);

  const allSelected =
    members.length > 0 &&
    members.every((member) => draft.has(normalizeEmail(member.email)));

  const toggleEmail = (email: string) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) next.delete(normalized);
      else next.add(normalized);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setDraft(new Set());
      return;
    }
    setDraft(
      new Set(
        members
          .map((member) => normalizeEmail(member.email))
          .filter(Boolean),
      ),
    );
  };

  const selectedCount = draft.size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="slot-participants-picker-modal"
      ariaLabelledBy="slot-participants-picker-title"
    >
      <header className="slot-participants-picker-modal__header">
        <h2
          id="slot-participants-picker-title"
          className="slot-participants-picker-modal__title"
        >
          Участники слота
        </h2>
        <button
          type="button"
          className="slot-participants-picker-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </header>

      <div className="slot-participants-picker-modal__toolbar">
        <input
          type="search"
          className="slot-participants-picker-modal__search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по имени или email…"
          aria-label="Поиск актёров"
        />
        <button
          type="button"
          className="slot-participants-picker-modal__select-all"
          onClick={toggleAll}
          disabled={members.length === 0}
        >
          {allSelected ? "Снять всех" : "Выбрать всех"}
        </button>
      </div>

      <div className="slot-participants-picker-modal__body">
        {filteredMembers.length === 0 ? (
          <p className="slot-participants-picker-modal__empty">
            {members.length === 0
              ? "В труппе театра пока нет участников."
              : "Никого не найдено."}
          </p>
        ) : (
          <ul className="slot-participants-picker-modal__list">
            {filteredMembers.map((member) => {
              const email = normalizeEmail(member.email);
              const label = memberLabel(member);
              const selected = draft.has(email);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    className={cn(
                      "slot-participants-picker-modal__item",
                      selected && "slot-participants-picker-modal__item--selected",
                    )}
                    onClick={() => toggleEmail(email)}
                    aria-pressed={selected}
                  >
                    <MiniAvatar
                      src={profileListAvatarSrc(member.profile)}
                      label={label}
                      size={40}
                      title={label}
                    />
                    <span className="slot-participants-picker-modal__item-text">
                      <span className="slot-participants-picker-modal__item-name">
                        {label}
                      </span>
                      <span className="slot-participants-picker-modal__item-email">
                        {email}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "slot-participants-picker-modal__check",
                        selected && "slot-participants-picker-modal__check--on",
                      )}
                      aria-hidden
                    >
                      {selected ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="slot-participants-picker-modal__footer">
        <span className="slot-participants-picker-modal__count">
          Выбрано: {selectedCount}
        </span>
        <button
          type="button"
          className="slot-participants-picker-modal__btn"
          onClick={onClose}
        >
          Отмена
        </button>
        <button
          type="button"
          className={cn(
            "slot-participants-picker-modal__btn",
            "slot-participants-picker-modal__btn--primary",
          )}
          onClick={() => {
            onApply(Array.from(draft));
            onClose();
          }}
        >
          Готово
        </button>
      </footer>
    </Modal>
  );
}
