/** Physical key (event.code) — works with RU/EN keyboard layouts. */
export function isTheaterPhysicalKey(
  event: KeyboardEvent,
  code: string,
  latinKey?: string,
): boolean {
  if (event.code === code) return true;
  if (latinKey && event.key.toLowerCase() === latinKey.toLowerCase()) {
    return true;
  }
  return false;
}

export function isTheaterEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox']",
    ) != null
  );
}

export function isInsideTheaterUi(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.closest(".theater-scene, .theater-controls, .theater-focus-panel") !=
    null
  );
}

/** Theater view is open (works even when focus is on canvas / body). */
export function isTheaterPageActive(): boolean {
  return document.querySelector(".theater-scene") != null;
}
