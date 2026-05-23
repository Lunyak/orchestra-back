import cn from "classnames";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import "./style.css";

export type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  noOptionsLabel?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  renderValue?: (option: CustomSelectOption | null) => React.ReactNode;
  renderOption?: (
    option: CustomSelectOption,
    state: { isSelected: boolean },
  ) => React.ReactNode;
};

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Выбрать",
  noOptionsLabel = "Нет опций",
  className,
  triggerClassName,
  dropdownClassName,
  optionClassName,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  renderValue,
  renderOption,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId();
  const listboxId = id ? `${id}-listbox` : `custom-select-${generatedId}-listbox`;
  const hasOptions = options.length > 0;
  const isDisabled = disabled || !hasOptions;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const triggerLabel = hasOptions
    ? selectedOption?.label || placeholder
    : noOptionsLabel;

  useEffect(() => {
    if (!hasOptions) setIsOpen(false);
  }, [hasOptions]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (!root || !(target instanceof Node)) return;
      if (root.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className={cn("custom-select", className, {
        open: isOpen,
        disabled: isDisabled,
      })}
    >
      <button
        type="button"
        className={cn("custom-select__trigger", triggerClassName)}
        onClick={() => {
          if (isDisabled) return;
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (isDisabled) return;
          if (event.key !== "ArrowDown" && event.key !== "Enter") return;
          event.preventDefault();
          setIsOpen(true);
        }}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
      >
        <span className="custom-select__label">
          {renderValue ? renderValue(selectedOption) : triggerLabel}
        </span>
        <span className="custom-select__chevron">▾</span>
      </button>
      {isOpen && !isDisabled ? (
        <div
          role="listbox"
          id={listboxId}
          className={cn("custom-select__dropdown", dropdownClassName)}
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={cn(
                  "custom-select__option",
                  optionClassName,
                  isSelected && "custom-select__option--selected",
                )}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {renderOption
                  ? renderOption(option, { isSelected })
                  : option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
