import cn from "classnames";
import React, { useId } from "react";
import "./style.css";

export type LabeledCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * Чекбокс с подписью: стили под тёмный UI (канбан / главная), без наследования от `.kanban-tool input`.
 */
export function LabeledCheckbox({
  checked,
  onChange,
  children,
  className,
  disabled,
  id: idProp,
}: LabeledCheckboxProps) {
  const reactId = useId();
  const id = idProp ?? `labeled-cb-${reactId.replace(/:/g, "")}`;
  return (
    <label className={cn("labeled-checkbox", className)} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="labeled-checkbox__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="labeled-checkbox__text">{children}</span>
    </label>
  );
}
