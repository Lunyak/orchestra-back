import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  beginScreenPointerGesture,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";
import { isTheaterRightClickNav } from "../../model/theater-right-click-nav";

export const THEATER_OBJECT_LONG_PRESS_MS = 480;

export type TheaterObjectContextOpenEvent = {
  clientX: number;
  clientY: number;
  point: THREE.Vector3;
  object: THREE.Object3D;
};

type LongPressState = {
  gesture: ScreenPointerGesture;
  point: THREE.Vector3;
  object: THREE.Object3D;
};

function toOpenEvent(
  event: ThreeEvent<PointerEvent | MouseEvent>,
): TheaterObjectContextOpenEvent {
  return {
    clientX: event.nativeEvent.clientX,
    clientY: event.nativeEvent.clientY,
    point: event.point.clone(),
    object: event.object,
  };
}

function abortOrbitGesture(event: ThreeEvent<PointerEvent>) {
  const target = event.nativeEvent.target;
  if (!(target instanceof Element)) return;
  target.dispatchEvent(
    new PointerEvent("pointercancel", {
      pointerId: event.pointerId,
      bubbles: true,
      cancelable: true,
    }),
  );
}

export function useTheaterObjectContextGesture(
  enabled: boolean,
  onOpen: (event: TheaterObjectContextOpenEvent) => void,
) {
  const pressRef = useRef<LongPressState | null>(null);
  const timerRef = useRef<number | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const clearPress = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pressRef.current = null;
  };

  useEffect(() => () => clearPress(), []);

  if (!enabled) {
    return {};
  }

  const handleContextMenu = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    clearPress();
    if (isTheaterRightClickNav()) return;
    onOpenRef.current(toOpenEvent(event));
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button === 2) {
      event.stopPropagation();
      return;
    }
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

    clearPress();
    const press: LongPressState = {
      gesture: beginScreenPointerGesture(
        event.pointerId,
        event.nativeEvent.clientX,
        event.nativeEvent.clientY,
      ),
      point: event.point.clone(),
      object: event.object,
    };
    pressRef.current = press;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const current = pressRef.current;
      pressRef.current = null;
      if (!current || current.gesture.dragged) return;
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
      onOpenRef.current({
        clientX: current.gesture.clientX,
        clientY: current.gesture.clientY,
        point: current.point,
        object: current.object,
      });
      abortOrbitGesture(event);
    }, THEATER_OBJECT_LONG_PRESS_MS);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const press = pressRef.current;
    if (!press || press.gesture.pointerId !== event.pointerId) return;
    updateScreenPointerGesture(
      press.gesture,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
    if (press.gesture.dragged) clearPress();
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (pressRef.current?.gesture.pointerId !== event.pointerId) return;
    clearPress();
  };

  return {
    onContextMenu: handleContextMenu,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };
}
