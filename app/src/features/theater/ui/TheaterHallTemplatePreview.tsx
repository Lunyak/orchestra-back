import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../shared/types/script";
import { DEFAULT_THEATER_LAYOUT } from "../model/theater-defaults";
import { applyTheaterHallTemplate } from "../model/theater-hall-templates";
import { TheaterCanvasShell } from "./canvas/TheaterCanvasShell";
import { TheaterStage } from "./three/TheaterStage";

type TheaterHallTemplatePreviewProps = {
  templateId: string;
};

function getHallPreviewCameraPose(layout: TheaterLayout) {
  const halfD = layout.hallDepth / 2;
  const halfW = layout.hallWidth / 2;
  const lastRowZ =
    layout.seatRows > 0
      ? layout.audienceStartZ + (layout.seatRows - 1) * layout.rowSpacing
      : halfD - 1;
  const cameraZ = Math.min(halfD - 0.12, lastRowZ + 1.15);
  const stageFront = layout.stageFrontZ ?? layout.audienceStartZ;
  const stageCenterZ = (-halfD + stageFront) / 2;
  return {
    position: [
      halfW * 0.1,
      Math.max(1.65, layout.wallHeight * 0.4),
      cameraZ,
    ] as [number, number, number],
    target: [0, 0.5, stageCenterZ] as [number, number, number],
    fov: 50,
    maxDistance: Math.max(layout.hallWidth, layout.hallDepth) * 2.4,
  };
}

function HallPreviewOrbit({ layout }: { layout: TheaterLayout }) {
  const { camera } = useThree();
  const pose = useMemo(() => getHallPreviewCameraPose(layout), [layout]);

  useLayoutEffect(() => {
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, pose]);

  return (
    <OrbitControls
      makeDefault
      target={pose.target}
      autoRotate
      autoRotateSpeed={0.55}
      enablePan={false}
      minPolarAngle={0.4}
      maxPolarAngle={Math.PI / 2.12}
      minDistance={2}
      maxDistance={pose.maxDistance}
    />
  );
}

export function TheaterHallTemplatePreview({
  templateId,
}: TheaterHallTemplatePreviewProps) {
  const layout = useMemo(
    () => applyTheaterHallTemplate(DEFAULT_THEATER_LAYOUT, templateId),
    [templateId],
  );
  const camera = useMemo(() => getHallPreviewCameraPose(layout), [layout]);

  return (
    <div className="theater-hall-template-preview">
      <TheaterCanvasShell
        className="theater-hall-template-preview__canvas"
        camera={{ position: camera.position, fov: camera.fov }}
        backgroundColor="#171717"
      >
        <Suspense fallback={null}>
          <TheaterStage
            projectName=""
            layout={layout}
            showSeats
            showStageGrid={false}
            wallsOpaque={false}
            wallsHideFromCamera
          />
        </Suspense>
        <HallPreviewOrbit layout={layout} />
      </TheaterCanvasShell>
    </div>
  );
}
