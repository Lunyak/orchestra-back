import { useCallback, useEffect, useRef, useState } from "react";

export type AnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function rectToAnchor(rect: DOMRect): AnchorRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function useAnnotationsPopoverPosition({
  enabled,
  activeAnnotationId,
  isOpen,
}: {
  enabled: boolean;
  activeAnnotationId: string | null;
  isOpen: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  const setAnchorFromRect = useCallback((rect: DOMRect) => {
    setAnchor(rectToAnchor(rect));
  }, []);

  const requestClose = useCallback(() => {
    setPosition(null);
  }, []);

  const clear = useCallback(() => {
    setAnchor(null);
    setPosition(null);
  }, []);

  const computePopoverPos = useCallback(
    (anchorRect: AnchorRect, size?: { width: number; height: number }) => {
      if (typeof window === "undefined") {
        return { top: anchorRect.bottom, left: anchorRect.left };
      }
      const margin = 12;
      const gap = 8;
      const width = size?.width ?? 380;
      const height = size?.height ?? 260;

      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;

      const left = clamp(
        anchorRect.left,
        margin,
        Math.max(margin, vw - width - margin),
      );
      const canPlaceBelow = anchorRect.bottom + gap + height <= vh - margin;
      const canPlaceAbove = anchorRect.top - gap - height >= margin;
      const top = canPlaceBelow
        ? anchorRect.bottom + gap
        : canPlaceAbove
          ? anchorRect.top - gap - height
          : clamp(
              anchorRect.bottom + gap,
              margin,
              Math.max(margin, vh - height - margin),
            );

      return { top, left };
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) {
      setPosition(null);
      return;
    }
    if (!anchor) {
      setPosition(null);
      return;
    }
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const update = () => {
      let anchorRect = anchor;
      if (activeAnnotationId && rootRef.current) {
        const el = rootRef.current.querySelector(
          `[data-anno-id="${CSS.escape(activeAnnotationId)}"]`,
        ) as HTMLElement | null;
        if (el) {
          anchorRect = rectToAnchor(el.getBoundingClientRect());
        }
      }

      const el = popoverRef.current;
      const size = el
        ? { width: el.offsetWidth, height: el.offsetHeight }
        : undefined;
      setPosition(computePopoverPos(anchorRect, size));
    };

    update();
    const raf = window.requestAnimationFrame(update);

    const onScrollOrResize = () => update();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [activeAnnotationId, anchor, computePopoverPos, enabled, isOpen]);

  return {
    rootRef,
    popoverRef,
    position,
    setAnchorFromRect,
    requestClose,
    clear,
  };
}

