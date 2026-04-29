import { useSyncExternalStore } from "react";

const MOBILE_MQ = "(max-width: 979px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQueryList = window.matchMedia(MOBILE_MQ);
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MQ).matches;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
