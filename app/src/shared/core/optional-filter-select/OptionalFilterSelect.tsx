import cn from "classnames";
import React from "react";
import "./style.css";

export type OptionalFilterSelectProps = {
  /** Пустая строка = «все», не выбран конкретный пункт. */
  value: string;
  onChange: (next: string) => void;
  /** Текст первой опции с value="" (плейсхолдер при «все»). */
  placeholder: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  children: React.ReactNode;
};

/**
 * `<select>`: value `""` означает «все»; в закрытом виде показывается `placeholder`, а не отдельная подпись «Все».
 */
function filterOutDuplicateEmptyOptions(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    if (typeof child.type === "string" && child.type === "option") {
      const v = (child.props as { value?: string }).value;
      if (v === "" || v === undefined) return null;
    }
    return child;
  });
}

export function OptionalFilterSelect({
  value,
  onChange,
  placeholder,
  className,
  id,
  "aria-label": ariaLabel,
  disabled,
  children,
}: OptionalFilterSelectProps) {
  const isEmpty = value === "";
  return (
    <select
      id={id}
      className={cn("optional-filter-select", className)}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      data-empty={isEmpty ? "" : undefined}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {filterOutDuplicateEmptyOptions(children)}
    </select>
  );
}
