import { useLayoutEffect, type RefObject } from "react";



const CHIP_SELECTOR = ".spectacle-run-kadr-strip__chip";

const CHIP_LAYOUT_SELECTOR = ".spectacle-run-kadr-strip__chip-layout";

const HEIGHT_VAR = "--spectacle-run-kadr-strip-chip-height";

const MIN_CHIP_HEIGHT = 460;

const MIN_CHIP_HEIGHT_SHORT = 400;

const SHORT_VIEWPORT_MAX_HEIGHT = 860;



function readMinChipHeight(root: HTMLElement | null): number {

  if (typeof window === "undefined") return MIN_CHIP_HEIGHT;

  if (!root) return MIN_CHIP_HEIGHT;



  const prevHeightVar = root.style.getPropertyValue(HEIGHT_VAR);

  root.style.removeProperty(HEIGHT_VAR);



  const chip = root.querySelector<HTMLElement>(CHIP_SELECTOR);

  const computedMinHeight = chip ? getComputedStyle(chip).minHeight : "";

  const parsed = Number.parseFloat(computedMinHeight);



  if (prevHeightVar) root.style.setProperty(HEIGHT_VAR, prevHeightVar);

  else root.style.removeProperty(HEIGHT_VAR);



  if (Number.isFinite(parsed) && parsed > 0) return parsed;



  return window.innerHeight <= SHORT_VIEWPORT_MAX_HEIGHT

    ? MIN_CHIP_HEIGHT_SHORT

    : MIN_CHIP_HEIGHT;

}



function measureMaxChipHeight(root: HTMLElement): number {

  const chips = Array.from(root.querySelectorAll<HTMLElement>(CHIP_SELECTOR));

  if (chips.length === 0) return readMinChipHeight(root);



  const prevVar = root.style.getPropertyValue(HEIGHT_VAR);

  root.style.removeProperty(HEIGHT_VAR);



  const minHeight = readMinChipHeight(root);

  let maxHeight = minHeight;



  for (const chip of chips) {

    const prevHeight = chip.style.height;

    const prevMinHeight = chip.style.minHeight;

    chip.style.height = "auto";

    chip.style.minHeight = "0";

    const measured = Math.max(chip.scrollHeight, chip.getBoundingClientRect().height);

    maxHeight = Math.max(maxHeight, measured);

    chip.style.height = prevHeight;

    chip.style.minHeight = prevMinHeight;

  }



  if (prevVar) root.style.setProperty(HEIGHT_VAR, prevVar);

  else root.style.removeProperty(HEIGHT_VAR);



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

      root.style.setProperty(HEIGHT_VAR, `${height}px`);

    };



    let roRaf: number | null = null;

    const scheduleApply = () => {

      if (roRaf != null) return;

      roRaf = requestAnimationFrame(() => {

        roRaf = null;

        apply();

      });

    };



    scheduleApply();



    const observer = new ResizeObserver(scheduleApply);

    observer.observe(root);



    const chips = root.querySelectorAll<HTMLElement>(CHIP_SELECTOR);

    chips.forEach((chip) => observer.observe(chip));



    const layouts = root.querySelectorAll<HTMLElement>(CHIP_LAYOUT_SELECTOR);

    layouts.forEach((layout) => observer.observe(layout));



    const onMediaSettle = () => scheduleApply();

    root.addEventListener("load", onMediaSettle, true);

    root.addEventListener("error", onMediaSettle, true);

    root.addEventListener("loadeddata", onMediaSettle, true);

    root.addEventListener("loadedmetadata", onMediaSettle, true);

    window.addEventListener("resize", scheduleApply);



    return () => {

      if (roRaf != null) cancelAnimationFrame(roRaf);

      observer.disconnect();

      root.removeEventListener("load", onMediaSettle, true);

      root.removeEventListener("error", onMediaSettle, true);

      root.removeEventListener("loadeddata", onMediaSettle, true);

      root.removeEventListener("loadedmetadata", onMediaSettle, true);

      window.removeEventListener("resize", scheduleApply);

    };

  }, [enabled, remeasureKey, stripRef]);

}


