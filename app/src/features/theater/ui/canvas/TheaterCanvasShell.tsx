import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, type ReactNode } from "react";
import * as THREE from "three";
import { filterTheaterRaycastHits } from "../../model/theater-object-context";
import { bindTheaterRightClickNavGuard } from "../../model/theater-right-click-nav";
import { THEATER_SCENE_TONE_EXPOSURE } from "../../model/theater-scene-lighting";

export type TheaterCanvasShellProps = {
  className?: string;
  camera: { position: [number, number, number]; fov: number };
  backgroundColor?: string;
  children: ReactNode;
};

function TheaterRightClickNavGuard() {
  const { gl } = useThree();
  useEffect(
    () => bindTheaterRightClickNavGuard(gl.domElement),
    [gl.domElement],
  );
  return null;
}

/** R3F root: tone mapping, camera, input guards. No scene entities. */
export function TheaterCanvasShell({
  className = "theater-canvas",
  camera,
  backgroundColor = "#6b7280",
  children,
}: TheaterCanvasShellProps) {
  return (
    <Canvas
      className={className}
      camera={{ position: camera.position, fov: camera.fov }}
      gl={{ preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = THEATER_SCENE_TONE_EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      raycaster={{ filter: filterTheaterRaycastHits }}
      onWheel={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      style={{ "--theater-canvas-bg": backgroundColor } as React.CSSProperties}
      dpr={[1, 1.5]}
    >
      <TheaterRightClickNavGuard />
      <color attach="background" args={[backgroundColor]} />
      {children}
    </Canvas>
  );
}
