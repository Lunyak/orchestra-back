import { useLayoutEffect, type RefObject } from "react";

const CHIP_SELECTOR = ".spectacle-run-kadr-strip__chip";
const MIN_CHIP_HEIGHT = 442;
const MIN_CHIP_HEIGHT_SHORT = 360;
const SHORT_VIEWPORT_MAX_HEIGHT = 860;

function readMinChipHeight(): number {
  if (typeof window === "undefined") return MIN_CHIP_HEIGHT;
  return window.innerHeight <= SHORT_VIEWPORT_MAX_HEIGHT
    ? MIN_CHIP_HEIGHT_SHORT
    : MIN_CHIP_HEIGHT;
}

function measureMaxChipHeight(root: HTMLElement): number {
  const chips = Array.from(root.querySelectorAll<HTMLElement>(CHIP_SELECTOR));
  if (chips.length === 0) return readMinChipHeight();

  const minHeight = readMinChipHeight();
  let maxHeight = minHeight;

  for (const chip of chips) {
    const prevHeight = chip.style.height;
    const prevMinHeight = chip.style.minHeight;
    chip.style.height = "auto";
    chip.style.minHeight = "0";
    maxHeight = Math.max(maxHeight, chip.getBoundingClientRect().height);
    chip.style.height = prevHeight;
    chip.style.minHeight = prevMinHeight;
  }

  return Math.ceil(maxHeight);
}

export function useProgRunKadrChipHeight(
  enabled: boolean,
  stripRef: RefObject<HTMLElement | null>,
  remeasureKey: string,
): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = stripRef.current;
    if (!root) return;

    const apply = () => {
      const height = measureMaxChipHeight(root);
      root.style.setProperty("--spectacle-run-kadr-strip-chip-height", `${height}px`);
    };

    apply();

    const observer = new ResizeObserver(() => apply());
    observer.observe(root);

    const chips = root.querySelectorAll<HTMLElement>(CHIP_SELECTOR);
    chips.forEach((chip) => observer.observe(chip));

    return () => observer.disconnect();
  }, [enabled, remeasureKey, stripRef]);
}
