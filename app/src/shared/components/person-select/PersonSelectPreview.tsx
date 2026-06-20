import cn from "classnames";
import { memberLabel } from "../../../features/troupe/model/troupe-page-utils";
import { MiniAvatar } from "../mini-avatar/MiniAvatar";
import "./style.css";

export type PersonSelectProfile = {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export function PersonSelectPreview({
  person,
  placeholder = "Не выбран",
  compact = false,
}: {
  person: PersonSelectProfile | null;
  placeholder?: string;
  /** Одна строка фиксированной высоты — для триггера селекта. */
  compact?: boolean;
}) {
  if (!person?.email) {
    return (
      <span
        className={cn(
          "person-select-preview",
          "person-select-preview--empty",
          compact && "person-select-preview--compact",
        )}
      >
        {placeholder}
      </span>
    );
  }

  const label = memberLabel(person);
  const avatarUrl = String(person.profile?.avatarUrl ?? "").trim() || null;

  return (
    <span
      className={cn("person-select-preview", compact && "person-select-preview--compact")}
    >
      <MiniAvatar src={avatarUrl} label={label} size={24} title={person.email} />
      <span className="person-select-preview__meta">
        <span className="person-select-preview__name">{label}</span>
        {!compact ? (
          <span className="person-select-preview__email">{person.email}</span>
        ) : null}
      </span>
    </span>
  );
}
