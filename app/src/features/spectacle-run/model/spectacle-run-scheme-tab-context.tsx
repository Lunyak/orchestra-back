import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { SpectacleRunSchemeTabId } from "./spectacle-run-scheme-tab";

type SpectacleRunSchemeTabContextValue = {
  activeTab: SpectacleRunSchemeTabId;
  setActiveTab: Dispatch<SetStateAction<SpectacleRunSchemeTabId>>;
};

const SpectacleRunSchemeTabContext =
  createContext<SpectacleRunSchemeTabContextValue | null>(null);

export function SpectacleRunSchemeTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<SpectacleRunSchemeTabId>("light");
  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
    }),
    [activeTab],
  );

  return (
    <SpectacleRunSchemeTabContext.Provider value={value}>
      {children}
    </SpectacleRunSchemeTabContext.Provider>
  );
}

export function useSpectacleRunSchemeTab(): SpectacleRunSchemeTabContextValue {
  const ctx = useContext(SpectacleRunSchemeTabContext);
  if (!ctx) {
    throw new Error(
      "useSpectacleRunSchemeTab must be used within SpectacleRunSchemeTabProvider",
    );
  }
  return ctx;
}

export function useSpectacleRunSchemeTabOptional():
  | SpectacleRunSchemeTabContextValue
  | null {
  return useContext(SpectacleRunSchemeTabContext);
}
