import { useSyncExternalStore } from "react";

const COMPACT_KADR_STRIP_MQ = "(max-width: 720px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQueryList = window.matchMedia(COMPACT_KADR_STRIP_MQ);
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COMPACT_KADR_STRIP_MQ).matches;
}

export function isCompactKadrStripViewport(): boolean {
  return getSnapshot();
}

/** Узкий экран: лента на всю ширину, без переключателя режимов. */
export function useCompactKadrStrip(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
