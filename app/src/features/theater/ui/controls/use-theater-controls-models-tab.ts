import { useMemo } from "react";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export function useTheaterControlsModelsTab(vm: TheaterSceneViewModel) {
  return useMemo(
    () =>
      vm.models.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [vm.models],
  );
}
