import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type SlotTargets = {
  left: HTMLElement | null;
  center: HTMLElement | null;
};

type SpectacleTechChromeSlotsContextValue = {
  setLeftTarget: (el: HTMLElement | null) => void;
  setCenterTarget: (el: HTMLElement | null) => void;
  leftTarget: HTMLElement | null;
  centerTarget: HTMLElement | null;
};

const SpectacleTechChromeSlotsContext =
  createContext<SpectacleTechChromeSlotsContextValue | null>(null);

export function SpectacleTechChromeSlotsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [targets, setTargets] = useState<SlotTargets>({
    left: null,
    center: null,
  });

  const setLeftTarget = useCallback((el: HTMLElement | null) => {
    setTargets((prev) => (prev.left === el ? prev : { ...prev, left: el }));
  }, []);

  const setCenterTarget = useCallback((el: HTMLElement | null) => {
    setTargets((prev) => (prev.center === el ? prev : { ...prev, center: el }));
  }, []);

  const value = useMemo(
    () => ({
      setLeftTarget,
      setCenterTarget,
      leftTarget: targets.left,
      centerTarget: targets.center,
    }),
    [setLeftTarget, setCenterTarget, targets.left, targets.center],
  );

  return (
    <SpectacleTechChromeSlotsContext.Provider value={value}>
      {children}
    </SpectacleTechChromeSlotsContext.Provider>
  );
}

function useSpectacleTechChromeSlots() {
  return useContext(SpectacleTechChromeSlotsContext);
}

export function SpectacleTechChromeLeftSlot() {
  const ctx = useSpectacleTechChromeSlots();
  return (
    <div
      className="spectacle-direction-switch__tech-left"
      ref={(el) => ctx?.setLeftTarget(el)}
    />
  );
}

export function SpectacleTechChromeCenterSlot() {
  const ctx = useSpectacleTechChromeSlots();
  return (
    <div
      className="spectacle-direction-switch__tech-center"
      ref={(el) => ctx?.setCenterTarget(el)}
    />
  );
}

export function SpectacleTechChromePortal({
  left = null,
  center = null,
}: {
  left?: ReactNode;
  center?: ReactNode;
}) {
  const ctx = useSpectacleTechChromeSlots();
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  if (!ctx || !mounted) return null;

  return (
    <>
      {left != null && ctx.leftTarget
        ? createPortal(left, ctx.leftTarget)
        : null}
      {center != null && ctx.centerTarget
        ? createPortal(center, ctx.centerTarget)
        : null}
    </>
  );
}
