import type { TheaterModel } from "../../../../shared/types/script";
import { decorMaterialProps } from "../../model/theater-decor-material";
import { DecorTexturedMaterial } from "./DecorTexturedMaterial";

const FACE_EPS = 0.002;

type TexturedFaceProps = {
  projectName: string;
  model: TheaterModel;
  surfaceWidth: number;
  surfaceHeight: number;
  color: string;
  tone: string | null;
  position: [number, number, number];
  rotation?: [number, number, number];
};

function TexturedFace({
  projectName,
  model,
  surfaceWidth,
  surfaceHeight,
  color,
  tone,
  position,
  rotation = [0, 0, 0],
}: TexturedFaceProps) {
  if (!model.decorTexture) return null;

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[surfaceWidth, surfaceHeight]} />
      <DecorTexturedMaterial
        projectName={projectName}
        model={model}
        surfaceWidth={surfaceWidth}
        surfaceHeight={surfaceHeight}
        color={color}
        tone={tone}
      />
    </mesh>
  );
}

type ParametricDecorBoxProps = {
  projectName: string;
  model: TheaterModel;
  width: number;
  height: number;
  depth: number;
  color: string;
  tone: string | null;
  /** Какие грани покрывать текстурой (остальные — сплошной цвет). */
  texturedFaces: Array<"front" | "back" | "top" | "bottom">;
};

export function ParametricDecorBox({
  projectName,
  model,
  width,
  height,
  depth,
  color,
  tone,
  texturedFaces,
}: ParametricDecorBoxProps) {
  const hasTexture = Boolean(model.decorTexture);
  const sideColor = tone || color;

  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...decorMaterialProps(model)} color={sideColor} />
      </mesh>
      {hasTexture &&
        texturedFaces.includes("front") && (
          <TexturedFace
            projectName={projectName}
            model={model}
            surfaceWidth={width}
            surfaceHeight={height}
            color={color}
            tone={tone}
            position={[0, height / 2, depth / 2 + FACE_EPS]}
          />
        )}
      {hasTexture &&
        texturedFaces.includes("back") && (
          <TexturedFace
            projectName={projectName}
            model={model}
            surfaceWidth={width}
            surfaceHeight={height}
            color={color}
            tone={tone}
            position={[0, height / 2, -depth / 2 - FACE_EPS]}
            rotation={[0, Math.PI, 0]}
          />
        )}
      {hasTexture &&
        texturedFaces.includes("top") && (
          <TexturedFace
            projectName={projectName}
            model={model}
            surfaceWidth={width}
            surfaceHeight={depth}
            color={color}
            tone={tone}
            position={[0, height + FACE_EPS, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        )}
      {hasTexture &&
        texturedFaces.includes("bottom") && (
          <TexturedFace
            projectName={projectName}
            model={model}
            surfaceWidth={width}
            surfaceHeight={depth}
            color={color}
            tone={tone}
            position={[0, -FACE_EPS, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        )}
    </group>
  );
}
