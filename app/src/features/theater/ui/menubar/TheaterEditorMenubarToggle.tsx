import type { ReactNode } from "react";

type TheaterEditorMenubarToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
};

export function TheaterEditorMenubarToggle({
  checked,
  disabled,
  onChange,
  children,
}: TheaterEditorMenubarToggleProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      className={[
        "theater-editor-menubar__option",
        "theater-editor-menubar__option--toggle",
        checked ? "theater-editor-menubar__option--toggle-on" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      {children}
    </button>
  );
}
