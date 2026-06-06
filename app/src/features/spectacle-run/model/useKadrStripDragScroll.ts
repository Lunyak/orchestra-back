import { useCallback, useEffect, useRef, type RefObject } from "react";

const DRAG_THRESHOLD_PX = 8;

export function useKadrStripDragScroll(trackRef: RefObject<HTMLDivElement | null>) {
  const draggedRef = useRef(false);

  const consumeDrag = useCallback(() => {
    if (!draggedRef.current) return false;
    draggedRef.current = false;
    return true;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let active = false;
    let dragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let pointerId: number | null = null;

    const stopTracking = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      active = false;
      dragging = false;
      pointerId = null;
      delete track.dataset.dragging;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active || event.pointerId !== pointerId) return;

      const deltaX = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        draggedRef.current = true;
        track.dataset.dragging = "true";
      }

      track.scrollLeft = startScrollLeft - deltaX;
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!active || event.pointerId !== pointerId) return;
      stopTracking();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      active = true;
      dragging = false;
      draggedRef.current = false;
      startX = event.clientX;
      startScrollLeft = track.scrollLeft;
      pointerId = event.pointerId;

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    };

    track.addEventListener("pointerdown", onPointerDown);

    return () => {
      track.removeEventListener("pointerdown", onPointerDown);
      stopTracking();
    };
  }, [trackRef]);

  return { consumeDrag };
}
