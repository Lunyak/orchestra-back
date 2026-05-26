import { useMemo } from "react";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export function useTheaterControlsHistoryTx(vm: TheaterSceneViewModel) {
  return useMemo(
    () => ({
      onInteractStart: vm.beginTheaterHistoryTransaction,
      onInteractEnd: vm.endTheaterHistoryTransaction,
    }),
    [vm.beginTheaterHistoryTransaction, vm.endTheaterHistoryTransaction],
  );
}
