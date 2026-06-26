import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  PLAYER_DOCK_OFFSET_CHANGE_EVENT,
  PLAYER_PREFS_STORAGE_KEY,
  readPlayerDockOffset,
  resetPlayerDockOffset,
  setPlayerDockOffset,
  type PlayerDockOffset,
} from "./player-prefs";

const DESKTOP_PLAYER_DRAG_MQ = "(min-width: 721px)";
const DRAG_THRESHOLD_PX = 4;
const VIEWPORT_MARGIN_PX = 8;

function subscribeDesktopDrag(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQueryList = window.matchMedia(DESKTOP_PLAYER_DRAG_MQ);
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getDesktopDragSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_PLAYER_DRAG_MQ).matches;
}

function clampOffsetToViewport(
  container: HTMLElement,
  inner: HTMLElement | null,
  offset: PlayerDockOffset,
): PlayerDockOffset {
  container.style.setProperty("--playlist-bottom-player-offset-x", `${offset.x}px`);
  container.style.setProperty("--playlist-bottom-player-offset-y", `${offset.y}px`);

  const rect = (inner ?? container).getBoundingClientRect();
  let nextX = offset.x;
  let nextY = offset.y;

  if (rect.left < VIEWPORT_MARGIN_PX) {
    nextX += VIEWPORT_MARGIN_PX - rect.left;
  }
  if (rect.right > window.innerWidth - VIEWPORT_MARGIN_PX) {
    nextX -= rect.right - (window.innerWidth - VIEWPORT_MARGIN_PX);
  }
  if (rect.top < VIEWPORT_MARGIN_PX) {
    nextY += VIEWPORT_MARGIN_PX - rect.top;
  }
  if (rect.bottom > window.innerHeight - VIEWPORT_MARGIN_PX) {
    nextY -= rect.bottom - (window.innerHeight - VIEWPORT_MARGIN_PX);
  }

  return { x: nextX, y: nextY };
}

function isDragBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;
  return Boolean(target.closest("button, input, label, a, [role='slider']"));
}

export function usePlaylistBottomPlayerDrag(
  containerRef: RefObject<HTMLDivElement | null>,
  innerRef: RefObject<HTMLDivElement | null>,
) {
  const canDrag = useSyncExternalStore(
    subscribeDesktopDrag,
    getDesktopDragSnapshot,
    () => false,
  );
  const [offset, setOffset] = useState<PlayerDockOffset>(readPlayerDockOffset);
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef(offset);
  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originOffset: PlayerDockOffset;
    dragging: boolean;
  } | null>(null);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    setOffset(readPlayerDockOffset());
  }, []);

  useEffect(() => {
    const onOffsetChange = (event: Event) => {
      const detail = (event as CustomEvent<{ offset?: PlayerDockOffset }>).detail;
      setOffset(detail?.offset ?? readPlayerDockOffset());
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === PLAYER_PREFS_STORAGE_KEY) {
        setOffset(readPlayerDockOffset());
      }
    };

    window.addEventListener(PLAYER_DOCK_OFFSET_CHANGE_EVENT, onOffsetChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLAYER_DOCK_OFFSET_CHANGE_EVENT, onOffsetChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const applyOffset = useCallback((nextOffset: PlayerDockOffset) => {
    const container = containerRef.current;
    if (!container) {
      setOffset(nextOffset);
      return;
    }
    const clamped = clampOffsetToViewport(container, innerRef.current, nextOffset);
    setOffset(clamped);
  }, [containerRef, innerRef]);

  const stopDrag = useCallback(() => {
    const session = dragSessionRef.current;
    dragSessionRef.current = null;
    setIsDragging(false);
    document.body.classList.remove("playlist-bottom-player-drag-active");

    if (session?.dragging) {
      setPlayerDockOffset(offsetRef.current);
    }
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      const deltaX = event.clientX - session.startX;
      const deltaY = event.clientY - session.startY;

      if (!session.dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX && Math.abs(deltaY) < DRAG_THRESHOLD_PX) {
          return;
        }
        session.dragging = true;
        setIsDragging(true);
      }

      applyOffset({
        x: session.originOffset.x + deltaX,
        y: session.originOffset.y + deltaY,
      });
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      stopDrag();
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [applyOffset, stopDrag]);

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canDrag || event.button !== 0) return;
      if (isDragBlockedTarget(event.target)) return;

      dragSessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originOffset: offsetRef.current,
        dragging: false,
      };

      document.body.classList.add("playlist-bottom-player-drag-active");
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [canDrag],
  );

  const onDragDoubleClick = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canDrag) return;
      if (isDragBlockedTarget(event.target)) return;
      resetPlayerDockOffset();
      setOffset(readPlayerDockOffset());
    },
    [canDrag],
  );

  const containerStyle = {
    "--playlist-bottom-player-offset-x": `${offset.x}px`,
    "--playlist-bottom-player-offset-y": `${offset.y}px`,
  } as CSSProperties;

  return {
    canDrag,
    isDragging,
    containerStyle,
    onDragPointerDown,
    onDragDoubleClick,
  };
}
