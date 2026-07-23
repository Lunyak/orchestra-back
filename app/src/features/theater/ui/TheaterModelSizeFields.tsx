import { useEffect, useRef, useState } from "react";
import cn from "classnames";
import type { TheaterModelWorldSize } from "../model/theater-model-world-size";

type SizeAxis = keyof TheaterModelWorldSize;

const AXIS_ORDER: SizeAxis[] = ["width", "height", "depth"];
const AXIS_LABEL: Record<SizeAxis, string> = {
  width: "Ширина",
  height: "Высота",
  depth: "Длина",
};

type TheaterModelSizeFieldsProps = {
  size: TheaterModelWorldSize;
  disabled?: boolean;
  className?: string;
  onCommit: (next: Partial<TheaterModelWorldSize>) => void;
};

function formatSizeInput(value: number) {
  return value.toFixed(2);
}

export function TheaterModelSizeFields({
  size,
  disabled = false,
  className,
  onCommit,
}: TheaterModelSizeFieldsProps) {
  const [draft, setDraft] = useState<Record<SizeAxis, string>>({
    width: formatSizeInput(size.width),
    depth: formatSizeInput(size.depth),
    height: formatSizeInput(size.height),
  });
  const [focusedAxis, setFocusedAxis] = useState<SizeAxis | null>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (focusedAxis) return;
    setDraft({
      width: formatSizeInput(size.width),
      depth: formatSizeInput(size.depth),
      height: formatSizeInput(size.height),
    });
  }, [focusedAxis, size.depth, size.height, size.width]);

  const commitAxis = (axis: SizeAxis) => {
    const parsed = Number(draft[axis].replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft((prev) => ({ ...prev, [axis]: formatSizeInput(size[axis]) }));
      return;
    }
    if (Math.abs(parsed - size[axis]) < 0.001) {
      setDraft((prev) => ({ ...prev, [axis]: formatSizeInput(size[axis]) }));
      return;
    }
    onCommit({ [axis]: parsed });
  };

  return (
    <div className={cn("theater-model-size-fields", className)} title="Габариты в метрах">
      {AXIS_ORDER.map((axis) => (
        <label key={axis} className="theater-model-size-fields__item">
          <span className="theater-model-size-fields__label">{AXIS_LABEL[axis]}</span>
          <input
            type="text"
            inputMode="decimal"
            className="native-text-input theater-model-size-fields__input"
            value={draft[axis]}
            disabled={disabled}
            aria-label={`${AXIS_LABEL[axis]}, метры`}
            title={`${AXIS_LABEL[axis]}, м`}
            onFocus={() => setFocusedAxis(axis)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft((prev) => ({ ...prev, [axis]: nextValue }));
            }}
            onBlur={() => {
              if (skipCommitRef.current) {
                skipCommitRef.current = false;
                setDraft((prev) => ({ ...prev, [axis]: formatSizeInput(size[axis]) }));
                setFocusedAxis(null);
                return;
              }
              commitAxis(axis);
              setFocusedAxis(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                skipCommitRef.current = true;
                setDraft((prev) => ({ ...prev, [axis]: formatSizeInput(size[axis]) }));
                (event.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
      ))}
      <span className="theater-model-size-fields__unit">м</span>
    </div>
  );
}
