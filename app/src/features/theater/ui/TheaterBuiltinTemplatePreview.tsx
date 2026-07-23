import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import {
  createBuiltinTheaterModel,
  type TheaterBuiltinTemplateKey,
} from "../model/theater-model-builtin";
import { BuiltinModel } from "./three/BuiltinModel";

export function TheaterBuiltinTemplatePreview({
  builtin,
}: {
  builtin: TheaterBuiltinTemplateKey;
}) {
  const previewModel = createBuiltinTheaterModel(1, builtin);

  return (
    <div className="theater-builtin-template-preview">
      <Canvas
        camera={{ position: [2.8, 2.2, 3.6], fov: 35 }}
        dpr={[1, 1.5]}
        shadows
      >
        <color attach="background" args={["#171717"]} />
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={2.2}
          castShadow
        />
        <Suspense fallback={null}>
          <Bounds key={builtin} fit clip observe margin={1.35}>
            <BuiltinModel projectName="" model={previewModel} />
          </Bounds>
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={1.2}
          enablePan={false}
          enableZoom={false}
          minDistance={0.5}
          maxDistance={12}
        />
      </Canvas>
    </div>
  );
}
