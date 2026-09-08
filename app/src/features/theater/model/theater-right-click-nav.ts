import {
  beginScreenPointerGesture,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "./pointer-click-gesture";

const CLEAR_AFTER_POINTER_UP_MS = 320;

let activeGesture: ScreenPointerGesture | null = null;

export function isTheaterRightClickNav(): boolean {
  return activeGesture?.dragged === true;
}

export function bindTheaterRightClickNavGuard(target: HTMLElement): () => void {
  let clearTimer: number | null = null;

  const cancelClear = () => {
    if (clearTimer == null) return;
    window.clearTimeout(clearTimer);
    clearTimer = null;
  };

  const scheduleClear = () => {
    cancelClear();
    clearTimer = window.setTimeout(() => {
      activeGesture = null;
      clearTimer = null;
    }, CLEAR_AFTER_POINTER_UP_MS);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 2) return;
    cancelClear();
    activeGesture = beginScreenPointerGesture(
      event.pointerId,
      event.clientX,
      event.clientY,
    );
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    updateScreenPointerGesture(activeGesture, event.clientX, event.clientY);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    updateScreenPointerGesture(activeGesture, event.clientX, event.clientY);
    scheduleClear();
  };

  const onContextMenu = (event: Event) => {
    if (!isTheaterRightClickNav()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  target.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerUp, true);
  target.addEventListener("contextmenu", onContextMenu, true);

  return () => {
    cancelClear();
    activeGesture = null;
    target.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    target.removeEventListener("contextmenu", onContextMenu, true);
  };
}
