import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { TheaterModel } from "../../../shared/types/script";
import { BuiltinModel } from "./three/BuiltinModel";
import { FileModelInstanceLoader } from "./three/FileModelInstanceLoader";

type TheaterModelPreviewProps = {
  projectName: string;
  model: TheaterModel;
};

function PreviewModelContent({
  projectName,
  model,
}: TheaterModelPreviewProps) {
  const previewModel: TheaterModel = {
    ...model,
    position: [0, 0, 0],
    rotation: [0, model.rotation?.[1] ?? 0, 0],
  };

  if (previewModel.file) {
    return (
      <FileModelInstanceLoader
        projectName={projectName}
        model={previewModel}
      />
    );
  }

  return <BuiltinModel projectName={projectName} model={previewModel} />;
}

export function TheaterModelPreview({
  projectName,
  model,
}: TheaterModelPreviewProps) {
  const previewKey = [
    model.id,
    model.builtin ?? "",
    model.file ?? "",
    model.decorColor ?? "",
    model.decorTexture ?? "",
    model.decorTextureMode ?? "",
    model.decorOpacity ?? "",
    model.decorRoughness ?? "",
    model.decorMetalness ?? "",
    model.decorEmissiveColor ?? "",
    model.decorEmissiveIntensity ?? "",
    model.decorSize?.join("x") ?? "",
  ].join("|");

  return (
    <div className="theater-builtin-template-preview theater-model-preview">
      <Canvas
        camera={{ position: [2.8, 2.2, 3.6], fov: 35 }}
        dpr={[1, 1.5]}
        shadows
      >
        <color attach="background" args={["#171717"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
        <Suspense fallback={null}>
          <Bounds key={previewKey} fit clip observe margin={1.35}>
            <PreviewModelContent projectName={projectName} model={model} />
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
