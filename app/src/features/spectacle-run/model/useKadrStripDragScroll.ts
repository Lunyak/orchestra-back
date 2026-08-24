import { useCallback, useEffect, useRef, type RefObject } from "react";

const DRAG_THRESHOLD_PX = 6;

export function useKadrStripDragScroll(
  trackRef: RefObject<HTMLDivElement | null>,
  options?: { onDragEnd?: () => void },
) {
  const draggedRef = useRef(false);
  const onDragEndRef = useRef(options?.onDragEnd);
  onDragEndRef.current = options?.onDragEnd;

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
    let lastX = 0;
    let pointerId: number | null = null;

    const unlockSnap = () => {
      track.dataset.dragging = "true";
      track.style.scrollSnapType = "none";
    };

    const restoreSnap = () => {
      delete track.dataset.dragging;
      track.style.scrollSnapType = "";
    };

    const stopTracking = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      const wasDragging = dragging;
      active = false;
      dragging = false;
      pointerId = null;
      restoreSnap();
      if (wasDragging) onDragEndRef.current?.();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active || event.pointerId !== pointerId) return;

      const deltaX = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        draggedRef.current = true;
        unlockSnap();
        startX = event.clientX;
        lastX = event.clientX;
      }

      const frameDelta = event.clientX - lastX;
      lastX = event.clientX;
      track.scrollLeft -= frameDelta;
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!active || event.pointerId !== pointerId) return;
      stopTracking();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // Touch/pen: native horizontal pan via touch-action. Mouse: drag-to-scroll.
      if (event.pointerType !== "mouse") return;

      active = true;
      dragging = false;
      draggedRef.current = false;
      startX = event.clientX;
      lastX = event.clientX;
      pointerId = event.pointerId;

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    };

    const onWheel = (event: WheelEvent) => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 1) return;

      const useHorizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = useHorizontalDelta ? event.deltaX : event.deltaY;
      if (delta === 0) return;

      const nextLeft = Math.max(0, Math.min(maxScroll, track.scrollLeft + delta));
      if (nextLeft === track.scrollLeft) return;

      event.preventDefault();
      track.scrollLeft = nextLeft;
    };

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("wheel", onWheel);
      stopTracking();
    };
  }, [trackRef]);

  return { consumeDrag };
}
