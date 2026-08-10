export type DashboardViewState = "loading" | "error" | "empty" | "ready";

export function resolveDashboardViewState(input: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  isEmpty: boolean;
}): DashboardViewState {
  if (input.isLoading) return "loading";
  if (input.isError || !input.hasData) return "error";
  return input.isEmpty ? "empty" : "ready";
}
