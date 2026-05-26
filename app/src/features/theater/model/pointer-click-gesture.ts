export const POINTER_CLICK_DRAG_THRESHOLD_PX = 8;

export type ScreenPointerGesture = {
  pointerId: number;
  clientX: number;
  clientY: number;
  dragged: boolean;
};

export function beginScreenPointerGesture(
  pointerId: number,
  clientX: number,
  clientY: number,
): ScreenPointerGesture {
  return { pointerId, clientX, clientY, dragged: false };
}

export function updateScreenPointerGesture(
  gesture: ScreenPointerGesture,
  clientX: number,
  clientY: number,
  thresholdPx = POINTER_CLICK_DRAG_THRESHOLD_PX,
): void {
  if (gesture.dragged) return;
  const dx = clientX - gesture.clientX;
  const dy = clientY - gesture.clientY;
  if (Math.hypot(dx, dy) >= thresholdPx) {
    gesture.dragged = true;
  }
}

export function isScreenPointerClick(
  gesture: ScreenPointerGesture | null,
  pointerId: number,
): gesture is ScreenPointerGesture {
  return gesture != null && gesture.pointerId === pointerId && !gesture.dragged;
}
