import { createContext, useContext, type ReactNode } from "react";
import type { useSpectacleRun } from "./useSpectacleRun";

export type SpectacleRunContextValue = ReturnType<typeof useSpectacleRun>;

const SpectacleRunContext = createContext<SpectacleRunContextValue | null>(null);

export function SpectacleRunProvider({
  value,
  children,
}: {
  value: SpectacleRunContextValue;
  children: ReactNode;
}) {
  return (
    <SpectacleRunContext.Provider value={value}>{children}</SpectacleRunContext.Provider>
  );
}

export function useSpectacleRunContext(): SpectacleRunContextValue {
  const ctx = useContext(SpectacleRunContext);
  if (!ctx) {
    throw new Error("useSpectacleRunContext must be used within SpectacleRunProvider");
  }
  return ctx;
}
