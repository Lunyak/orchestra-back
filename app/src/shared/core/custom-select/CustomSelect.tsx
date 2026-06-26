import cn from "classnames";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterCustomSelectOptions } from "./custom-select-search";
import "./style.css";

export type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Дополнительный текст для поиска (имя, email, алиасы). */
  searchText?: string;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  noOptionsLabel?: string;
  searchPlaceholder?: string;
  noSearchResultsLabel?: string;
  /** Поиск по label, value и searchText. По умолчанию включён. */
  searchable?: boolean;
  /** Минимум опций, при котором показывается поле поиска. */
  minOptionsForSearch?: number;
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
  searchPlaceholder = "Поиск…",
  noSearchResultsLabel = "Ничего не найдено",
  searchable = true,
  minOptionsForSearch = 2,
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
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const generatedId = useId();
  const listboxId = id ? `${id}-listbox` : `custom-select-${generatedId}-listbox`;
  const searchInputId = id ? `${id}-search` : `custom-select-${generatedId}-search`;
  const hasOptions = options.length > 0;
  const isDisabled = disabled || !hasOptions;
  const showSearch = searchable && options.length >= minOptionsForSearch;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const triggerLabel = hasOptions
    ? selectedOption?.label || placeholder
    : noOptionsLabel;

  const filteredOptions = useMemo(
    () => (showSearch ? filterCustomSelectOptions(options, searchQuery) : options),
    [options, searchQuery, showSearch],
  );

  useEffect(() => {
    if (!hasOptions) setIsOpen(false);
  }, [hasOptions]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }

    if (!showSearch) return;

    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, showSearch]);

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

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

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
          className={cn("custom-select__dropdown-container", dropdownClassName)}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {showSearch ? (
            <div className="custom-select__search-container">
              <input
                ref={searchInputRef}
                id={searchInputId}
                type="search"
                className="custom-select__search"
                value={searchQuery}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    closeDropdown();
                  }
                }}
              />
            </div>
          ) : null}
          <div role="listbox" id={listboxId} className="custom-select__dropdown" aria-label={ariaLabel}>
            {filteredOptions.length === 0 ? (
              <div className="custom-select__empty">{noSearchResultsLabel}</div>
            ) : (
              filteredOptions.map((option) => {
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
                      closeDropdown();
                    }}
                  >
                    {renderOption
                      ? renderOption(option, { isSelected })
                      : option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
