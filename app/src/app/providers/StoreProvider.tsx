import type { ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "../../shared/store/store";

export function StoreProvider({ children }: { children: ReactNode }) {
  return <ReduxProvider store={store}>{children}</ReduxProvider>;
}

