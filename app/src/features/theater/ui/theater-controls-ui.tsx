import cn from "classnames";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Button } from "../../../shared/core/button/Button";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import type { CustomSelectOption } from "../../../shared/core/custom-select/CustomSelect";
import { LabeledCheckbox } from "../../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { TheaterModel } from "../../../shared/types/script";

export const BUILTIN_MODEL_OPTIONS: CustomSelectOption[] = [
  { value: "roundTable", label: "Круглый стол" },
  { value: "chair", label: "Стул" },
  { value: "sofa", label: "Диван" },
  { value: "bench", label: "Скамейка" },
  { value: "cabinet", label: "Тумба" },
  { value: "blackCube", label: "Черный куб" },
  { value: "strawGrid", label: "Сетка + солома" },
  { value: "actor", label: "Актер" },
  { value: "humanStanding", label: "Человек — стоит" },
  { value: "humanSitting", label: "Человек — сидит" },
  { value: "humanSmoothStanding", label: "Человек сглаженный — стоит" },
  { value: "humanSmoothSitting", label: "Человек сглаженный — сидит" },
  { value: "fence", label: "Забор" },
  { value: "dancer", label: "Танцор" },
];

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
      className={cn("theater-btn", active ? "is-active" : "secondary", className)}
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
        triggerClassName="theater-select"
        aria-label={ariaLabel ?? label}
      />
    </TheaterField>
  );
}

export function parseBuiltinKey(value: string): TheaterModel["builtin"] | undefined {
  const found = BUILTIN_MODEL_OPTIONS.find((o) => o.value === value);
  return found ? (found.value as TheaterModel["builtin"]) : undefined;
}
