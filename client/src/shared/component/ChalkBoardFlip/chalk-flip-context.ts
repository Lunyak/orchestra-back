import { createContext, useContext } from "react";

export type FlipFace = "front" | "back" | null;

export type ChalkFlipContextValue = {
  active: boolean;
  face: FlipFace;
  turning: boolean;
  turnTo: (path: string) => void;
};

export const ChalkFlipContext = createContext<ChalkFlipContextValue>({
  active: false,
  face: null,
  turning: false,
  turnTo: () => {},
});

export function useChalkFlipFace(): ChalkFlipContextValue {
  return useContext(ChalkFlipContext);
}
