import cn from "classnames";
import { useId, type ReactNode } from "react";
import "./style.css";

export type LabeledToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
};

export function LabeledToggle({
  checked,
  onChange,
  children,
  className,
  disabled,
  id: idProp,
}: LabeledToggleProps) {
  const reactId = useId();
  const id = idProp ?? `labeled-toggle-${reactId.replace(/:/g, "")}`;

  return (
    <label className={cn("labeled-toggle", className)} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="labeled-toggle__input"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="labeled-toggle__track" aria-hidden />
      <span className="labeled-toggle__text">{children}</span>
    </label>
  );
}
