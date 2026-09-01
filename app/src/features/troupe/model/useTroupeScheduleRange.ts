import { useEffect, useRef, useState } from "react";
import {
  type IsoDayRange,
  orderIsoDayRange,
} from "./troupe-page-utils";

type RangeDragKind = "header" | "mine";

function dayIsoFromPoint(clientX: number, clientY: number): string | null {
  const node = document
    .elementFromPoint(clientX, clientY)
    ?.closest("[data-troupe-day]");
  return node?.getAttribute("data-troupe-day") ?? null;
}

function extendOrToggleRange(
  prev: IsoDayRange | null,
  dayIso: string,
): IsoDayRange | null {
  if (!prev) return { from: dayIso, to: dayIso };
  if (prev.from === prev.to && prev.from !== dayIso) {
    return orderIsoDayRange(prev.from, dayIso);
  }
  if (prev.from === dayIso && prev.to === dayIso) return null;
  return { from: dayIso, to: dayIso };
}

export function useTroupeScheduleRange(monthKey: string) {
  const [committed, setCommitted] = useState<IsoDayRange | null>(null);
  const [draft, setDraft] = useState<IsoDayRange | null>(null);
  const dragRef = useRef<{
    anchor: string;
    hover: string;
    didMove: boolean;
    kind: RangeDragKind;
  } | null>(null);
  const suppressMineClickRef = useRef(false);

  useEffect(() => {
    setCommitted(null);
    setDraft(null);
    dragRef.current = null;
    suppressMineClickRef.current = false;
  }, [monthKey]);

  useEffect(() => {
    const finish = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const next = orderIsoDayRange(drag.anchor, drag.hover);
      setDraft(null);
      if (drag.kind === "mine" && !drag.didMove) return;
      if (drag.kind === "mine") suppressMineClickRef.current = true;
      if (drag.didMove) {
        setCommitted(next);
        return;
      }
      setCommitted((prev) => extendOrToggleRange(prev, drag.anchor));
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, []);

  const beginDayPointer = (
    dayIso: string,
    target: HTMLElement,
    pointerId: number,
    kind: RangeDragKind,
  ) => {
    target.setPointerCapture(pointerId);
    dragRef.current = { anchor: dayIso, hover: dayIso, didMove: false, kind };
    if (kind === "header") {
      setDraft({ from: dayIso, to: dayIso });
    }
  };

  const moveDayPointer = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dayIso = dayIsoFromPoint(clientX, clientY);
    if (!dayIso || dayIso === drag.hover) return;
    drag.didMove = true;
    drag.hover = dayIso;
    setDraft(orderIsoDayRange(drag.anchor, dayIso));
  };

  const activateHeaderDay = (dayIso: string) => {
    setCommitted((prev) => extendOrToggleRange(prev, dayIso));
  };

  const shouldIgnoreMineClick = () => {
    if (!suppressMineClickRef.current) return false;
    suppressMineClickRef.current = false;
    return true;
  };

  return {
    visibleRange: draft ?? committed,
    committedRange: committed,
    beginDayPointer,
    moveDayPointer,
    activateHeaderDay,
    shouldIgnoreMineClick,
  };
}
