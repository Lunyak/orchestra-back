import type { TheaterDoorStyle } from "../../../../shared/types/script";

export const STAGE_DOOR_MODEL_BASE = { width: 1.2, height: 2.2 } as const;

const W = STAGE_DOOR_MODEL_BASE.width;
const H = STAGE_DOOR_MODEL_BASE.height;

const WOOD = {
  leaf: "#6b4424",
  panel: "#472b17",
  frame: "#57381f",
  handle: "#b89e47",
} as const;

const METAL = {
  leaf: "#59616b",
  dark: "#2e333b",
  glass: "#8cb2d1",
  handle: "#b89e47",
} as const;

function DoorBox({
  args,
  position,
  color,
  roughness,
  metalness = 0,
  opacity = 1,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  roughness: number;
  metalness?: number;
  opacity?: number;
}) {
  const transparent = opacity < 1;
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        opacity={opacity}
        transparent={transparent}
      />
    </mesh>
  );
}

function WoodDoor() {
  const thickness = 0.045;
  const frameW = 0.07;
  const inset = 0.012;
  const panelW = W - frameW * 2;
  const gap = 0.06;
  const upperH = 0.95;
  const lowerH = 0.72;
  const upperY = frameW + lowerH + gap + upperH / 2 + 0.08;
  const lowerY = frameW + lowerH / 2 + 0.08;
  const midY = lowerY + lowerH / 2 + gap / 2;
  const casingT = 0.06;
  const casingD = 0.09;
  const handleX = W * 0.38;
  const handleY = 1.05;

  return (
    <group>
      <DoorBox
        args={[W, H, thickness]}
        position={[0, H / 2, 0]}
        color={WOOD.leaf}
        roughness={0.72}
      />
      <DoorBox
        args={[panelW, upperH, thickness + inset]}
        position={[0, upperY, thickness * 0.15]}
        color={WOOD.panel}
        roughness={0.78}
      />
      <DoorBox
        args={[panelW, lowerH, thickness + inset]}
        position={[0, lowerY, thickness * 0.15]}
        color={WOOD.panel}
        roughness={0.78}
      />
      <DoorBox
        args={[panelW, gap * 0.85, thickness * 1.05]}
        position={[0, midY, 0]}
        color={WOOD.frame}
        roughness={0.7}
      />
      <DoorBox
        args={[W + casingT * 2, casingT, casingD]}
        position={[0, H + casingT / 2, -0.02]}
        color={WOOD.frame}
        roughness={0.7}
      />
      <DoorBox
        args={[casingT, H, casingD]}
        position={[-(W / 2 + casingT / 2), H / 2, -0.02]}
        color={WOOD.frame}
        roughness={0.7}
      />
      <DoorBox
        args={[casingT, H, casingD]}
        position={[W / 2 + casingT / 2, H / 2, -0.02]}
        color={WOOD.frame}
        roughness={0.7}
      />
      <DoorBox
        args={[0.08, 0.16, 0.01]}
        position={[handleX, handleY, thickness / 2 + 0.008]}
        color={WOOD.handle}
        roughness={0.28}
        metalness={0.9}
      />
      <mesh
        position={[handleX, handleY, thickness / 2 + 0.05]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.012, 0.012, 0.09, 12]} />
        <meshStandardMaterial
          color={WOOD.handle}
          roughness={0.28}
          metalness={0.9}
        />
      </mesh>
    </group>
  );
}

function MetalDoor() {
  const thickness = 0.04;
  const casingT = 0.055;
  const casingD = 0.085;
  const winW = 0.28;
  const winH = 0.42;
  const winY = 1.55;
  const barY = 1.05;
  const ribYs = [0.45, 0.85, 1.35, 1.75] as const;

  return (
    <group>
      <DoorBox
        args={[W, H, thickness]}
        position={[0, H / 2, 0]}
        color={METAL.leaf}
        roughness={0.38}
        metalness={0.65}
      />
      {ribYs.map((ribY) => (
        <DoorBox
          key={ribY}
          args={[W * 0.92, 0.035, thickness + 0.008]}
          position={[0, ribY, thickness * 0.2]}
          color={METAL.dark}
          roughness={0.42}
          metalness={0.75}
        />
      ))}
      <DoorBox
        args={[winW + 0.04, winH + 0.04, thickness + 0.01]}
        position={[0, winY, thickness * 0.15]}
        color={METAL.dark}
        roughness={0.42}
        metalness={0.75}
      />
      <DoorBox
        args={[winW, winH, thickness * 0.4]}
        position={[0, winY, thickness * 0.35]}
        color={METAL.glass}
        roughness={0.08}
        opacity={0.35}
      />
      <DoorBox
        args={[W + casingT * 2, casingT, casingD]}
        position={[0, H + casingT / 2, -0.02]}
        color={METAL.dark}
        roughness={0.42}
        metalness={0.75}
      />
      <DoorBox
        args={[casingT, H, casingD]}
        position={[-(W / 2 + casingT / 2), H / 2, -0.02]}
        color={METAL.dark}
        roughness={0.42}
        metalness={0.75}
      />
      <DoorBox
        args={[casingT, H, casingD]}
        position={[W / 2 + casingT / 2, H / 2, -0.02]}
        color={METAL.dark}
        roughness={0.42}
        metalness={0.75}
      />
      <DoorBox
        args={[W * 0.62, 0.03, 0.025]}
        position={[0, barY, thickness / 2 + 0.02]}
        color={METAL.handle}
        roughness={0.28}
        metalness={0.9}
      />
      <DoorBox
        args={[0.03, 0.08, 0.04]}
        position={[-(W * 0.28), barY, thickness / 2 + 0.02]}
        color={METAL.handle}
        roughness={0.28}
        metalness={0.9}
      />
      <DoorBox
        args={[0.03, 0.08, 0.04]}
        position={[W * 0.28, barY, thickness / 2 + 0.02]}
        color={METAL.handle}
        roughness={0.28}
        metalness={0.9}
      />
      <DoorBox
        args={[W * 0.96, 0.22, thickness + 0.006]}
        position={[0, 0.14, thickness * 0.15]}
        color={METAL.dark}
        roughness={0.42}
        metalness={0.75}
      />
    </group>
  );
}

export function StageDoorModel({ style = "wood" }: { style?: TheaterDoorStyle }) {
  if (style === "metal") return <MetalDoor />;
  return <WoodDoor />;
}
