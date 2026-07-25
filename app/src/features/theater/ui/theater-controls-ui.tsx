import cn from "classnames";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Button } from "../../../shared/core/button/Button";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import type { CustomSelectOption } from "../../../shared/core/custom-select/CustomSelect";
import type { TheaterModel } from "../../../shared/types/script";
import {
  isTheaterBuiltinTemplateKey,
  THEATER_BUILTIN_TEMPLATES,
} from "../model/theater-model-builtin";

export const BUILTIN_MODEL_OPTIONS: CustomSelectOption[] = THEATER_BUILTIN_TEMPLATES.map(
  (item) => ({
    value: item.key,
    label: item.label,
  }),
);

export function rangeFillStyle(min: number, max: number, value: number): CSSProperties {
  const pct = max <= min ? 0 : ((value - min) / (max - min)) * 100;
  return { "--range-fill": `${pct}%` } as CSSProperties;
}

type TheaterBtnProps = {
  active?: boolean;
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  title?: string;
  className?: string;
};

export function TheaterBtn({
  active,
  children,
  onClick,
  disabled,
  title,
  className,
}: TheaterBtnProps) {
  return (
    <Button
      type="button"
      className={cn("theater-btn", active ? "button--active" : "secondary", className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

type TheaterFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function TheaterField({ label, children, className }: TheaterFieldProps) {
  return (
    <label className={cn("theater-field", className)}>
      <span className="theater-label">{label}</span>
      {children}
    </label>
  );
}

type TheaterRangeFieldProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
};

export function TheaterRangeField({
  label,
  min,
  max,
  step,
  value,
  disabled,
  formatValue = (v) => String(v),
  onChange,
  onInteractStart,
  onInteractEnd,
}: TheaterRangeFieldProps) {
  return (
    <label className="theater-range-field">
      <span className="theater-label">{label}</span>
      <input
        type="range"
        className="theater-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={rangeFillStyle(min, max, value)}
        onPointerDown={() => onInteractStart?.()}
        onPointerUp={() => onInteractEnd?.()}
        onPointerCancel={() => onInteractEnd?.()}
        onBlur={() => onInteractEnd?.()}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="theater-range-value">{formatValue(value)}</span>
    </label>
  );
}

type TheaterSelectProps = {
  label: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  noOptionsLabel?: string;
  searchable?: boolean;
  "aria-label"?: string;
};

export function TheaterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder,
  noOptionsLabel,
  searchable = false,
  "aria-label": ariaLabel,
}: TheaterSelectProps) {
  return (
    <TheaterField label={label}>
      <CustomSelect
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        noOptionsLabel={noOptionsLabel}
        searchable={searchable}
        triggerClassName="theater-select"
        aria-label={ariaLabel ?? label}
      />
    </TheaterField>
  );
}

export function parseBuiltinKey(value: string): TheaterModel["builtin"] | undefined {
  return isTheaterBuiltinTemplateKey(value) ? value : undefined;
}
