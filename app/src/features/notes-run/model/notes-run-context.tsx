import { createContext, useContext } from "react";
import type { NotesRunContextValue } from "../model/useNotesRun";

const NotesRunContext = createContext<NotesRunContextValue | null>(null);

export function NotesRunProvider({
  value,
  children,
}: {
  value: NotesRunContextValue;
  children: React.ReactNode;
}) {
  return <NotesRunContext.Provider value={value}>{children}</NotesRunContext.Provider>;
}

export function useNotesRunContext(): NotesRunContextValue {
  const ctx = useContext(NotesRunContext);
  if (!ctx) throw new Error("useNotesRunContext outside NotesRunProvider");
  return ctx;
}
