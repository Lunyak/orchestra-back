import { useEffect, useState } from "react";
import type { TheaterSpotlight } from "../../../../../shared/types/script";

type SpotlightListNameInputProps = {
  item: TheaterSpotlight;
  active: boolean;
  disabled?: boolean;
  placeholder: string;
  onSelect: (shiftKey: boolean) => void;
  onLabelCommit: (label: string) => void;
};

export function SpotlightListNameInput({
  item,
  active,
  disabled,
  placeholder,
  onSelect,
  onLabelCommit,
}: SpotlightListNameInputProps) {
  const [draft, setDraft] = useState(item.label);

  useEffect(() => {
    setDraft(item.label);
  }, [item.id, item.label]);

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed || placeholder;
    if (next !== item.label) {
      onLabelCommit(next);
      return;
    }
    if (draft !== item.label) {
      setDraft(item.label);
    }
  };

  return (
    <input
      type="text"
      className={[
        "native-text-input",
        "theater-spotlight-name-input",
        active ? "theater-spotlight-name-input--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      title="Название"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => onSelect(event.shiftKey)}
      onFocus={() => onSelect(false)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(item.label);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
