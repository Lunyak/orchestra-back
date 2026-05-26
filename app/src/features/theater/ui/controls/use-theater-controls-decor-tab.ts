import { useCallback, useRef } from "react";
import { useProject } from "../../../project/model/project-context";
import { useTheaterControlsHistoryTx } from "./use-theater-controls-history-tx";
import { useTheaterControlsModelsTab } from "./use-theater-controls-models-tab";
import {
  isParametricDecorBuiltin,
  resolveDecorSize,
} from "../../model/theater-decor-catalog";
import { getDecorTexturePresetId } from "../../model/theater-decor-textures";
import {
  resolveDecorTextureFaces,
  supportsDecorTextureFaces,
} from "../../model/theater-decor-faces";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export function useTheaterControlsDecorTab(vm: TheaterSceneViewModel) {
  const { projectName } = useProject();
  const modelSelectOptions = useTheaterControlsModelsTab(vm);
  const historyTx = useTheaterControlsHistoryTx(vm);
  const decorTextureInputRef = useRef<HTMLInputElement>(null);
  const decorTemplateInputRef = useRef<HTMLInputElement>(null);

  const draftDecorSize = vm.decorDraftSize ?? vm.activeDecorPreset.defaultSize;
  const draftDecorColor = vm.decorDraftColor ?? vm.activeDecorPreset.defaultColor;
  const activeParametricSize =
    vm.activeModel && isParametricDecorBuiltin(vm.activeModel.builtin)
      ? resolveDecorSize(vm.activeModel)
      : null;
  const showDecorTextures =
    vm.activeDecorPreset.parametric ||
    Boolean(vm.activeModel && isParametricDecorBuiltin(vm.activeModel.builtin));
  const activeDecorTexture =
    vm.activeModel?.decorTexture ?? vm.decorDraftTexture ?? undefined;
  const activeDecorTexturePresetId = getDecorTexturePresetId(activeDecorTexture);
  const activeDecorTextureRepeat =
    vm.activeModel?.decorTextureRepeat ?? vm.decorDraftTextureRepeat;
  const activeDecorTextureMode =
    vm.activeModel?.decorTextureMode ?? vm.decorDraftTextureMode;
  const activeTextureFaces =
    vm.activeModel && supportsDecorTextureFaces(vm.activeModel.builtin)
      ? resolveDecorTextureFaces(vm.activeModel)
      : [];

  const setDraftSizeAxis = useCallback(
    (axis: 0 | 1 | 2, value: number) => {
      const base = activeParametricSize ?? draftDecorSize;
      const next = [...base] as [number, number, number];
      next[axis] = value;
      if (activeParametricSize && vm.activeModelId) {
        vm.updateModel(vm.activeModelId, { decorSize: next });
        return;
      }
      vm.setDecorDraftSize(next);
    },
    [
      activeParametricSize,
      draftDecorSize,
      vm.activeModelId,
      vm.setDecorDraftSize,
      vm.updateModel,
    ],
  );

  return {
    projectName,
    modelSelectOptions,
    historyTx,
    decorTextureInputRef,
    decorTemplateInputRef,
    draftDecorSize,
    draftDecorColor,
    activeParametricSize,
    showDecorTextures,
    activeDecorTexture,
    activeDecorTexturePresetId,
    activeDecorTextureRepeat,
    activeDecorTextureMode,
    activeTextureFaces,
    setDraftSizeAxis,
  };
}
