import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { TheaterModel } from "../../../../shared/types/script";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { GltfGuard } from "./GltfGuard";

const ACTOR_MODEL_URL = resolvePublicAssetUrl("theater/humans/theater-actor-black.glb");

const ACTOR_POSE_CLIPS: Record<NonNullable<TheaterModel["actorPose"]>, string> = {
  stand: "Stand",
  sit: "Sit",
  lie: "Lie",
};

const ACTOR_POSE_OFFSETS: Record<
  NonNullable<TheaterModel["actorPose"]>,
  [number, number, number]
> = {
  stand: [0.008, 0.001, -0.049],
  sit: [0.009, 0, 0.12],
  lie: [0.004, 0.07, -0.768],
};

function cloneActorScene(source: THREE.Object3D) {
  const scene = SkeletonUtils.clone(source);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  return scene;
}

function ActorModelInner({
  pose,
  tone,
}: {
  pose: NonNullable<TheaterModel["actorPose"]>;
  tone?: string | null;
}) {
  const gltf = useGLTF(ACTOR_MODEL_URL);
  const scene = useMemo(() => cloneActorScene(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const poseOffset = ACTOR_POSE_OFFSETS[pose];

  useEffect(() => {
    names.forEach((name) => actions[name]?.stop());
    const action = actions[ACTOR_POSE_CLIPS[pose]];
    if (!action) return;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.time = action.getClip().duration;
    action.paused = true;
    return () => {
      action.stop();
    };
  }, [actions, names, pose]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.color) return;
        const originalColor =
          standard.userData.actorOriginalColor ??
          (standard.userData.actorOriginalColor = standard.color.clone());
        if (tone) {
          standard.color.set(tone);
        } else {
          standard.color.copy(originalColor);
        }
      });
    });
  }, [scene, tone]);

  return (
    <group position={poseOffset}>
      <primitive object={scene} />
    </group>
  );
}

export function ActorModel({
  pose,
  tone,
}: {
  pose: NonNullable<TheaterModel["actorPose"]>;
  tone?: string | null;
}) {
  return (
    <GltfGuard resetKey={pose}>
      <ActorModelInner pose={pose} tone={tone} />
    </GltfGuard>
  );
}
