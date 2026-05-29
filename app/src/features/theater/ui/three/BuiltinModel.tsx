import { Suspense } from "react";
import { tc } from "../../../../shared/styles/theme-color";
import type { TheaterModel } from "../../../../shared/types/script";
import {
  isParametricDecorBuiltin,
  resolveDecorColor,
  resolveDecorSize,
} from "../../model/theater-decor-catalog";
import { decorMaterialProps } from "../../model/theater-decor-material";
import { resolveDecorTextureFaces } from "../../model/theater-decor-faces";
import {
  BENCH_METRICS,
  CHAIR_METRICS,
  ROUND_TABLE_METRICS,
  SOFA_METRICS,
  TABLE_METRICS,
} from "../../model/theater-furniture-metrics";
import { DecorTexturedMaterial } from "./DecorTexturedMaterial";
import { HangingFabricModel } from "./HangingFabricModel";
import { ParametricDecorBox } from "./ParametricDecorBox";
import { DancerModel } from "./DancerModel";
import { HumanModel } from "./HumanModel";
import { StrawGridModel } from "./StrawGridModel";

function ParametricPanel({
  projectName,
  model,
  width,
  height,
  depth,
  color,
  tone,
  texturedFaces,
}: {
  projectName: string;
  model: TheaterModel;
  width: number;
  height: number;
  depth: number;
  color: string;
  tone: string | null;
  texturedFaces: Array<"front" | "back" | "top" | "bottom">;
}) {
  if (model.decorTexture) {
    return (
      <ParametricDecorBox
        projectName={projectName}
        model={model}
        width={width}
        height={height}
        depth={depth}
        color={color}
        tone={tone}
        texturedFaces={texturedFaces}
      />
    );
  }

  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial {...decorMaterialProps(model)} color={tone || color} />
    </mesh>
  );
}

export const BuiltinModel = ({
  projectName,
  model,
  isSelected,
  isHovered,
}: {
  projectName: string;
  model: TheaterModel;
  isSelected?: boolean;
  isHovered?: boolean;
}) => {
  const kind = model.builtin;
  const tone = isSelected ? tc("--color-error") : isHovered ? tc("--color-primary-light") : null;
  const decorColor = resolveDecorColor(model) ?? tc("--color-surface-2");

  if (kind === "flat") {
    const [w, h, d] = resolveDecorSize(model);
    return (
      <ParametricPanel
        projectName={projectName}
        model={model}
        width={w}
        height={h}
        depth={d}
        color={decorColor}
        tone={tone}
        texturedFaces={resolveDecorTextureFaces(model)}
      />
    );
  }

  if (kind === "platform") {
    const [w, h, d] = resolveDecorSize(model);
    return (
      <ParametricPanel
        projectName={projectName}
        model={model}
        width={w}
        height={h}
        depth={d}
        color={decorColor}
        tone={tone}
        texturedFaces={resolveDecorTextureFaces(model)}
      />
    );
  }

  if (kind === "curtain") {
    const [w, h, d] = resolveDecorSize(model);
    const foldCount = Math.max(4, Math.min(14, Math.round(w / 0.65)));
    const foldW = w / foldCount;
    const folds = Array.from({ length: foldCount }, (_, index) => {
      const x = -w / 2 + foldW / 2 + index * foldW;
      const shade = index % 2 === 0 ? 0.88 : 1;
      const panelW = foldW * 0.92;
      const panelH = h * 0.96;
      return (
        <mesh key={index} position={[x, h / 2, 0]}>
          <boxGeometry args={[panelW, panelH, d]} />
          <Suspense fallback={<meshStandardMaterial color={tone || decorColor} />}>
            <DecorTexturedMaterial
              projectName={projectName}
              model={model}
              surfaceWidth={panelW}
              surfaceHeight={panelH}
              color={decorColor}
              tone={tone}
              opacity={shade}
              transparent={!tone}
            />
          </Suspense>
        </mesh>
      );
    });
    return (
      <group>
        {folds}
        <mesh position={[0, h + 0.08, 0]}>
          <boxGeometry args={[w * 1.02, 0.16, d * 1.4]} />
          {model.decorTexture ? (
            <Suspense fallback={<meshStandardMaterial color={tone || tc("--color-3d-gold")} />}>
              <DecorTexturedMaterial
                projectName={projectName}
                model={model}
                surfaceWidth={w * 1.02}
                surfaceHeight={0.16}
                color={decorColor}
                tone={tone}
              />
            </Suspense>
          ) : (
            <meshStandardMaterial
              {...decorMaterialProps(model)}
              color={tone || tc("--color-3d-gold")}
            />
          )}
        </mesh>
      </group>
    );
  }

  if (kind === "hangingFabric") {
    const [w, h, d] = resolveDecorSize(model);
    return (
      <HangingFabricModel
        projectName={projectName}
        model={model}
        width={w}
        height={h}
        foldDepth={d}
        color={decorColor}
        tone={tone}
      />
    );
  }

  if (kind === "screen") {
    const [w, h, d] = resolveDecorSize(model);
    const legH = Math.min(0.45, h * 0.22);
    const panelH = h - legH;
    return (
      <group>
        <group position={[0, legH, 0]}>
          <ParametricPanel
            projectName={projectName}
            model={model}
            width={w}
            height={panelH}
            depth={d}
            color={decorColor}
            tone={tone}
            texturedFaces={resolveDecorTextureFaces(model)}
          />
        </group>
        <mesh position={[-w * 0.38, legH / 2, 0]}>
          <boxGeometry args={[0.06, legH, 0.06]} />
          <meshStandardMaterial color={tone || tc("--color-surface-1")} />
        </mesh>
        <mesh position={[w * 0.38, legH / 2, 0]}>
          <boxGeometry args={[0.06, legH, 0.06]} />
          <meshStandardMaterial color={tone || tc("--color-surface-1")} />
        </mesh>
      </group>
    );
  }

  if (isParametricDecorBuiltin(kind)) {
    return null;
  }

  if (kind === "table") {
    const topY = TABLE_METRICS.height - TABLE_METRICS.topThickness / 2;
    const legHeight = TABLE_METRICS.height - TABLE_METRICS.topThickness;
    const legCenterY = legHeight / 2;
    const halfW = TABLE_METRICS.width / 2 - TABLE_METRICS.legInset;
    const halfD = TABLE_METRICS.depth / 2 - TABLE_METRICS.legInset;
    const legPositions: [number, number][] = [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
    ];
    return (
      <group>
        <mesh position={[0, topY, 0]}>
          <boxGeometry
            args={[TABLE_METRICS.width, TABLE_METRICS.topThickness, TABLE_METRICS.depth]}
          />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-light")} />
        </mesh>
        {legPositions.map(([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, legCenterY, z]}>
            <boxGeometry
              args={[
                TABLE_METRICS.legThickness,
                legHeight,
                TABLE_METRICS.legThickness,
              ]}
            />
            <meshStandardMaterial color={tone || tc("--color-3d-wood")} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "roundTable") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry
            args={[
              ROUND_TABLE_METRICS.radius,
              ROUND_TABLE_METRICS.radius,
              ROUND_TABLE_METRICS.topThickness,
              24,
            ]}
          />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-light")} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry
            args={[
              ROUND_TABLE_METRICS.pedestalRadius,
              ROUND_TABLE_METRICS.pedestalRadius,
              ROUND_TABLE_METRICS.pedestalHeight,
              16,
            ]}
          />
          <meshStandardMaterial color={tone || tc("--color-3d-wood")} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry
            args={[
              ROUND_TABLE_METRICS.baseRadius,
              ROUND_TABLE_METRICS.baseRadius,
              ROUND_TABLE_METRICS.baseHeight,
              20,
            ]}
          />
          <meshStandardMaterial color={tone || tc("--color-3d-wood")} />
        </mesh>
      </group>
    );
  }
  if (kind === "chair") {
    const seatCenterY = CHAIR_METRICS.seatHeight - CHAIR_METRICS.seatThickness / 2;
    const legHeight = CHAIR_METRICS.seatHeight - CHAIR_METRICS.seatThickness;
    const legY = legHeight / 2;
    const legX = CHAIR_METRICS.width / 2 - CHAIR_METRICS.legInset;
    const legZ = CHAIR_METRICS.depth / 2 - CHAIR_METRICS.legInset;
    const legPositions: [number, number][] = [
      [-legX, -legZ],
      [legX, -legZ],
      [-legX, legZ],
      [legX, legZ],
    ];
    return (
      <group>
        <mesh position={[0, seatCenterY, 0]}>
          <boxGeometry
            args={[CHAIR_METRICS.width, CHAIR_METRICS.seatThickness, CHAIR_METRICS.depth]}
          />
          <meshStandardMaterial color={tone || tc("--color-slate-600")} />
        </mesh>
        <mesh
          position={[
            0,
            CHAIR_METRICS.seatHeight + CHAIR_METRICS.backHeight / 2,
            CHAIR_METRICS.backZ,
          ]}
        >
          <boxGeometry
            args={[
              CHAIR_METRICS.width,
              CHAIR_METRICS.backHeight,
              CHAIR_METRICS.backThickness,
            ]}
          />
          <meshStandardMaterial color={tone || tc("--color-border-default")} />
        </mesh>
        {legPositions.map(([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, legY, z]}>
            <boxGeometry
              args={[CHAIR_METRICS.legThickness, legHeight, CHAIR_METRICS.legThickness]}
            />
            <meshStandardMaterial color={tone || tc("--color-surface-1")} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "bench") {
    const seatCenterY = BENCH_METRICS.seatHeight - BENCH_METRICS.seatThickness / 2;
    const legHeight = BENCH_METRICS.seatHeight - BENCH_METRICS.seatThickness;
    const legY = legHeight / 2;
    const legX = BENCH_METRICS.width / 2 - BENCH_METRICS.legInset;
    return (
      <group>
        <mesh position={[0, seatCenterY, 0]}>
          <boxGeometry
            args={[BENCH_METRICS.width, BENCH_METRICS.seatThickness, BENCH_METRICS.depth]}
          />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-tan")} />
        </mesh>
        <mesh position={[-legX, legY, 0]}>
          <boxGeometry args={[BENCH_METRICS.legThickness, legHeight, BENCH_METRICS.depth * 0.8]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-dark")} />
        </mesh>
        <mesh position={[legX, legY, 0]}>
          <boxGeometry args={[BENCH_METRICS.legThickness, legHeight, BENCH_METRICS.depth * 0.8]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-dark")} />
        </mesh>
      </group>
    );
  }
  if (kind === "sofa") {
    return (
      <group>
        <mesh position={[0, SOFA_METRICS.seatHeight, 0.05]}>
          <boxGeometry
            args={[SOFA_METRICS.width, SOFA_METRICS.seatThickness, SOFA_METRICS.depth * 0.72]}
          />
          <meshStandardMaterial color={tone || tc("--color-slate-600")} />
        </mesh>
        <mesh
          position={[
            0,
            SOFA_METRICS.seatHeight + SOFA_METRICS.backHeight / 2,
            SOFA_METRICS.backZ,
          ]}
        >
          <boxGeometry
            args={[SOFA_METRICS.width, SOFA_METRICS.backHeight, SOFA_METRICS.backThickness]}
          />
          <meshStandardMaterial color={tone || tc("--color-border-default")} />
        </mesh>
        <mesh
          position={[
            -SOFA_METRICS.width / 2 + SOFA_METRICS.armWidth / 2,
            SOFA_METRICS.armHeight / 2,
            0.03,
          ]}
        >
          <boxGeometry
            args={[SOFA_METRICS.armWidth, SOFA_METRICS.armHeight, SOFA_METRICS.depth * 0.78]}
          />
          <meshStandardMaterial color={tone || tc("--color-slate-700")} />
        </mesh>
        <mesh
          position={[
            SOFA_METRICS.width / 2 - SOFA_METRICS.armWidth / 2,
            SOFA_METRICS.armHeight / 2,
            0.03,
          ]}
        >
          <boxGeometry
            args={[SOFA_METRICS.armWidth, SOFA_METRICS.armHeight, SOFA_METRICS.depth * 0.78]}
          />
          <meshStandardMaterial color={tone || tc("--color-slate-700")} />
        </mesh>
      </group>
    );
  }
  if (kind === "cabinet") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.9, 1.0, 0.4]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-accent")} />
        </mesh>
        <mesh position={[0, 0.5, 0.21]}>
          <boxGeometry args={[0.85, 0.95, 0.02]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-brown")} />
        </mesh>
        <mesh position={[0.25, 0.55, 0.23]}>
          <boxGeometry args={[0.05, 0.05, 0.03]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-gold")} />
        </mesh>
      </group>
    );
  }
  if (kind === "blackCube") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={tone || tc("--color-3d-black")} />
        </mesh>
      </group>
    );
  }
  if (kind === "strawGrid") {
    return <StrawGridModel />;
  }
  if (kind === "actor") {
    return (
      <group>
        <mesh position={[0, 1.6, 0]}>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color={tone || tc("--color-text-light")} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 0.9, 18]} />
          <meshStandardMaterial color={tone || tc("--color-text-muted")} />
        </mesh>
        <mesh position={[-0.38, 1.08, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={tone || tc("--color-text-dimmer")} />
        </mesh>
        <mesh position={[0.38, 1.08, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={tone || tc("--color-text-dimmer")} />
        </mesh>
        <mesh position={[-0.16, 0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={tone || tc("--color-slate-600")} />
        </mesh>
        <mesh position={[0.16, 0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={tone || tc("--color-slate-600")} />
        </mesh>
      </group>
    );
  }
  if (
    kind === "humanStanding" ||
    kind === "humanSitting" ||
    kind === "humanSmoothStanding" ||
    kind === "humanSmoothSitting"
  ) {
    return <HumanModel model={{ ...model, builtin: kind }} tone={tone} />;
  }
  if (kind === "dancer") {
    return <DancerModel tone={tone} />;
  }
  if (kind === "fence") {
    return (
      <group>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[2.2, 0.18, 0.12]} />
          <meshStandardMaterial color={tone || tc("--color-3d-gold")} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[2.2, 0.18, 0.12]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-light")} />
        </mesh>
        <mesh position={[-0.9, 0.65, 0]}>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-brown")} />
        </mesh>
        <mesh position={[0.9, 0.65, 0]}>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={tone || tc("--color-3d-wood-brown")} />
        </mesh>
      </group>
    );
  }
  return null;
};
