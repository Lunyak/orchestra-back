import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
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

function TheaterCanvasViewportSync() {
  const { camera, gl, size } = useThree();
  useLayoutEffect(() => {
    const width = Math.max(1, Math.floor(size.width));
    const height = Math.max(1, Math.floor(size.height));
    gl.setSize(width, height, false);
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const nextAspect = width / height;
    if (Math.abs(camera.aspect - nextAspect) < 0.0001) return;
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
  }, [camera, gl, size.height, size.width]);
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
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      resize={{ debounce: 0, scroll: false }}
      onCreated={({ gl, setEvents }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = THEATER_SCENE_TONE_EXPOSURE;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        setEvents({ filter: (items) => filterTheaterRaycastHits(items) });
      }}
      onWheel={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      style={{ "--theater-canvas-bg": backgroundColor } as React.CSSProperties}
      dpr={[1, 2]}
    >
      <TheaterCanvasViewportSync />
      <TheaterRightClickNavGuard />
      <color attach="background" args={[backgroundColor]} />
      {children}
    </Canvas>
  );
}
