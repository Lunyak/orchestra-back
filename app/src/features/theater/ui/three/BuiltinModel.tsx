import type { TheaterModel } from "../../../../shared/types/script";
import { DancerModel } from "./DancerModel";
import { StrawGridModel } from "./StrawGridModel";

export const BuiltinModel = ({
  kind,
  isSelected,
  isHovered,
}: {
  kind: TheaterModel["builtin"];
  isSelected?: boolean;
  isHovered?: boolean;
}) => {
  const tone = isSelected ? "#ef4444" : isHovered ? "#3b82f6" : null;
  if (kind === "roundTable") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, 0.08, 24]} />
          <meshStandardMaterial color={tone || "#8b5e34"} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.5, 16]} />
          <meshStandardMaterial color={tone || "#6b4423"} />
        </mesh>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.06, 20]} />
          <meshStandardMaterial color={tone || "#6b4423"} />
        </mesh>
      </group>
    );
  }
  if (kind === "chair") {
    return (
      <group>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color={tone || "#475569"} />
        </mesh>
        <mesh position={[0, 0.43, -0.2]} castShadow>
          <boxGeometry args={[0.5, 0.36, 0.08]} />
          <meshStandardMaterial color={tone || "#1f2937"} />
        </mesh>
        <mesh position={[-0.2, 0.04, -0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
        <mesh position={[0.2, 0.04, -0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
        <mesh position={[-0.2, 0.04, 0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
        <mesh position={[0.2, 0.04, 0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
      </group>
    );
  }
  if (kind === "bench") {
    return (
      <group>
        <mesh position={[0, 0.17, 0]} castShadow>
          <boxGeometry args={[1.2, 0.03, 0.20]} />
          <meshStandardMaterial color={tone || "#6b4f2b"} />
        </mesh>
        <mesh position={[-0.45, 0.08, 0]} castShadow>
          <boxGeometry args={[0.05, 0.16, 0.22]} />
          <meshStandardMaterial color={tone || "#3b2f1e"} />
        </mesh>
        <mesh position={[0.45, 0.08, 0]} castShadow>
          <boxGeometry args={[0.05, 0.16, 0.22]} />
          <meshStandardMaterial color={tone || "#3b2f1e"} />
        </mesh>
      </group>
    );
  }
  if (kind === "cabinet") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.9, 1.0, 0.4]} />
          <meshStandardMaterial color={tone || "#9f6b3d"} />
        </mesh>
        <mesh position={[0, 0.5, 0.21]} castShadow>
          <boxGeometry args={[0.85, 0.95, 0.02]} />
          <meshStandardMaterial color={tone || "#7c4f2a"} />
        </mesh>
        <mesh position={[0.25, 0.55, 0.23]} castShadow>
          <boxGeometry args={[0.05, 0.05, 0.03]} />
          <meshStandardMaterial color={tone || "#d1a05a"} />
        </mesh>
      </group>
    );
  }
  if (kind === "blackCube") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={tone || "#0b0b0b"} />
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
        <mesh position={[0, 1.6, 0]} castShadow>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color={tone || "#cbd5f5"} />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.9, 18]} />
          <meshStandardMaterial color={tone || "#94a3b8"} />
        </mesh>
        <mesh position={[-0.38, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={tone || "#64748b"} />
        </mesh>
        <mesh position={[0.38, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={tone || "#64748b"} />
        </mesh>
        <mesh position={[-0.16, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={tone || "#475569"} />
        </mesh>
        <mesh position={[0.16, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={tone || "#475569"} />
        </mesh>
      </group>
    );
  }
  if (kind === "dancer") {
    return <DancerModel tone={tone} />;
  }
  if (kind === "fence") {
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[2.2, 0.18, 0.12]} />
          <meshStandardMaterial color={tone || "#a16207"} />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[2.2, 0.18, 0.12]} />
          <meshStandardMaterial color={tone || "#8b5e34"} />
        </mesh>
        <mesh position={[-0.9, 0.65, 0]} castShadow>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={tone || "#7c4f2a"} />
        </mesh>
        <mesh position={[0.9, 0.65, 0]} castShadow>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={tone || "#7c4f2a"} />
        </mesh>
      </group>
    );
  }
  return null;
};

