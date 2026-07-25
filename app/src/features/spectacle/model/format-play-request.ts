const OPEN_FORMAT_PLAY_EVENT = "orchestra:open-format-play";

export function requestOpenFormatPlay() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_FORMAT_PLAY_EVENT));
}

export function subscribeOpenFormatPlay(handler: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => handler();
  window.addEventListener(OPEN_FORMAT_PLAY_EVENT, listener);
  return () => window.removeEventListener(OPEN_FORMAT_PLAY_EVENT, listener);
}
