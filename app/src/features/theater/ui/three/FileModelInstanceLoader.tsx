import type { TheaterModel } from "../../../../shared/types/script";
import type * as THREE from "three";
import { useTheaterModelFileUrl } from "../../model/theater-model-asset-url";
import { FileModelInstance } from "./FileModelInstance";

type FileModelInstanceLoaderProps = {
  projectName: string;
  model: TheaterModel;
  isActive?: boolean;
  onActiveObjectChange?: (node: THREE.Object3D | null, id: number) => void;
  onObjectReady?: (node: THREE.Object3D | null, id: number) => void;
  onSelect?: (additive?: boolean) => void;
  onActivate?: () => void;
  onContextMenu?: (modelId: number, clientX: number, clientY: number) => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (next: boolean) => void;
  passThroughPointerEvents?: boolean;
};

export function FileModelInstanceLoader({
  projectName,
  model,
  ...rest
}: FileModelInstanceLoaderProps) {
  const url = useTheaterModelFileUrl(projectName, model.file);
  if (!url) return null;
  return <FileModelInstance model={model} url={url} {...rest} />;
}
