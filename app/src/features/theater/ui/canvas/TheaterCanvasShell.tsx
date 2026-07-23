import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import * as THREE from "three";
import { THEATER_SCENE_TONE_EXPOSURE } from "../../model/theater-scene-lighting";

export type TheaterCanvasShellProps = {
  className?: string;
  camera: { position: [number, number, number]; fov: number };
  backgroundColor?: string;
  children: ReactNode;
};

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
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = THEATER_SCENE_TONE_EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      onWheel={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      style={{ "--theater-canvas-bg": backgroundColor } as React.CSSProperties}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={[backgroundColor]} />
      {children}
    </Canvas>
  );
}
