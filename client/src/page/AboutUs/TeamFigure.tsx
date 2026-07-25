import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { SRGBColorSpace } from "three";

const FIGURE_MIN_POLAR_ANGLE = Math.PI / 3;
const FIGURE_MAX_POLAR_ANGLE = Math.PI / 1.8;

function TeamFigureModel({ src }: { src: string }) {
  const gltf = useGLTF(src);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  return (
    <Bounds fit clip observe margin={1.15}>
      <primitive object={scene} />
    </Bounds>
  );
}

export function TeamFigure({
  src,
  name,
}: {
  src: string;
  name: string;
}) {
  return (
    <div className="aboutus-card__figure" aria-label={`3D-фигурка: ${name}`}>
      <Canvas
        camera={{ position: [0, 1.35, 4], fov: 32 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <ambientLight intensity={1.35} />
        <directionalLight position={[3, 5, 4]} intensity={2.4} />
        <directionalLight position={[-3, 2, -2]} intensity={0.8} />
        <Suspense fallback={null}>
          <TeamFigureModel src={src} />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          minPolarAngle={FIGURE_MIN_POLAR_ANGLE}
          maxPolarAngle={FIGURE_MAX_POLAR_ANGLE}
        />
      </Canvas>
      <span className="aboutus-card__figure-hint">Потяните, чтобы повернуть</span>
    </div>
  );
}
