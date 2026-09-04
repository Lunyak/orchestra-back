import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { TheaterModel } from "../../../../shared/types/script";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { GltfGuard } from "./GltfGuard";

type HumanBuiltin = Extract<
  TheaterModel["builtin"],
  "humanStanding" | "humanSitting" | "humanSmoothStanding" | "humanSmoothSitting"
>;

const HUMAN_MODEL_URLS: Record<HumanBuiltin, string> = {
  humanStanding: resolvePublicAssetUrl("theater/humans/human-standing.glb"),
  humanSitting: resolvePublicAssetUrl("theater/humans/human-sitting.glb"),
  humanSmoothStanding: resolvePublicAssetUrl("theater/humans/human-standing.glb"),
  humanSmoothSitting: resolvePublicAssetUrl("theater/humans/human-sitting.glb"),
};

const DEFAULT_HUMAN_COLORS = {
  skin: "#d7a77f",
  top: "#334155",
  bottom: "#1e293b",
  shoes: "#111827",
};

function smoothGeometry(geometry: THREE.BufferGeometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute("position");
  if (!position) return geometry.clone();

  const vertices: number[] = [];
  const indices: number[] = [];
  const indexByPosition = new Map<string, number>();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = `${x.toFixed(5)}:${y.toFixed(5)}:${z.toFixed(5)}`;
    let nextIndex = indexByPosition.get(key);
    if (nextIndex == null) {
      nextIndex = vertices.length / 3;
      indexByPosition.set(key, nextIndex);
      vertices.push(x, y, z);
    }
    indices.push(nextIndex);
  }

  const next = new THREE.BufferGeometry();
  next.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  next.setIndex(indices);
  next.computeVertexNormals();
  next.computeBoundingBox();
  next.computeBoundingSphere();
  return next;
}

function cloneSceneWithMaterials(scene: THREE.Object3D, smooth: boolean) {
  const cloned = SkeletonUtils.clone(scene);
  cloned.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (smooth && mesh.geometry) {
      mesh.geometry = smoothGeometry(mesh.geometry);
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  return cloned;
}

function resolveHumanPart(mesh: THREE.Mesh): "skin" | "top" | "bottom" | "shoes" | null {
  const name = mesh.name.toLowerCase();
  if (name.includes("skin")) return "skin";
  if (name.includes("shirt")) return "top";
  if (name.includes("pants")) return "bottom";
  if (name.includes("shoes")) return "shoes";
  return null;
}

function resolveHumanColor(
  part: ReturnType<typeof resolveHumanPart>,
  model: TheaterModel,
) {
  if (part === "skin") return model.humanSkinColor ?? DEFAULT_HUMAN_COLORS.skin;
  if (part === "top") return model.humanTopColor ?? DEFAULT_HUMAN_COLORS.top;
  if (part === "bottom") return model.humanBottomColor ?? DEFAULT_HUMAN_COLORS.bottom;
  if (part === "shoes") return model.humanShoeColor ?? DEFAULT_HUMAN_COLORS.shoes;
  return null;
}

function createHumanMaterial(color: string, tone?: string | null) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0,
    flatShading: false,
  });

  if (tone) {
    material.emissive.set(tone);
    material.emissiveIntensity = 0.18;
  }

  return material;
}

function applyHumanMaterials(
  scene: THREE.Object3D,
  model: TheaterModel,
  tone?: string | null,
) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const part = resolveHumanPart(mesh);
    const color = resolveHumanColor(part, model);
    if (!color) return;
    mesh.material = createHumanMaterial(color, tone);
  });
}

function HumanModelInner({
  model,
  tone,
}: {
  model: TheaterModel & { builtin: HumanBuiltin };
  tone?: string | null;
}) {
  const url = HUMAN_MODEL_URLS[model.builtin];
  const gltf = useGLTF(url);
  const smooth =
    model.builtin === "humanSmoothStanding" || model.builtin === "humanSmoothSitting";
  const scene = useMemo(
    () => cloneSceneWithMaterials(gltf.scene, smooth),
    [gltf.scene, smooth],
  );

  useEffect(() => {
    applyHumanMaterials(scene, model, tone);
  }, [model, scene, tone]);

  return <primitive object={scene} />;
}

export function HumanModel({
  model,
  tone,
}: {
  model: TheaterModel & { builtin: HumanBuiltin };
  tone?: string | null;
}) {
  return (
    <GltfGuard resetKey={model.builtin}>
      <HumanModelInner model={model} tone={tone} />
    </GltfGuard>
  );
}
