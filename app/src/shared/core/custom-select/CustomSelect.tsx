import cn from "classnames";
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
  /** Выравнивание портального дропдауна относительно триггера. */
  dropdownAlign?: "start" | "end";
  /** Минимальная ширина портального дропдауна. */
  dropdownMinWidth?: number;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  renderValue?: (option: CustomSelectOption | null) => React.ReactNode;
  renderOption?: (
    option: CustomSelectOption,
    state: { isSelected: boolean },
  ) => React.ReactNode;
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
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
  dropdownAlign = "start",
  dropdownMinWidth = 220,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  renderValue,
  renderOption,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
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

  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const maxHeight = Math.max(140, Math.min(280, spaceBelow));
      const width = Math.max(rect.width, dropdownMinWidth);
      const preferredLeft =
        dropdownAlign === "end" ? rect.right - width : rect.left;
      const maxLeft = window.innerWidth - width - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(preferredLeft, maxLeft));

      setDropdownPosition({
        top: rect.bottom + 4,
        left,
        width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [
    isOpen,
    filteredOptions.length,
    showSearch,
    dropdownAlign,
    dropdownMinWidth,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
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

  const dropdown =
    isOpen && !isDisabled && dropdownPosition ? (
      <div
        ref={dropdownRef}
        className={cn(
          "custom-select__dropdown-container",
          "custom-select__dropdown-container--portal",
          dropdownClassName,
        )}
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          maxHeight: dropdownPosition.maxHeight,
        }}
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
        <div
          role="listbox"
          id={listboxId}
          className="custom-select__dropdown"
          aria-label={ariaLabel}
        >
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
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn("custom-select", className, {
        open: isOpen,
        disabled: isDisabled,
      })}
    >
      <button
        ref={triggerRef}
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
      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
