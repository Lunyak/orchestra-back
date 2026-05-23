import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";

export const TheaterChair = ({ position }: { position: [number, number, number] }) => (
  <group position={position} rotation={[0, Math.PI, 0]}>
    <mesh position={[0, 0.18, 0]} castShadow>
      <boxGeometry args={[0.7, 0.12, 0.6]} />
      <meshStandardMaterial color="#334155" />
    </mesh>
    <mesh position={[0, 0.48, -0.22]} castShadow>
      <boxGeometry args={[0.7, 0.6, 0.1]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
    <mesh position={[-0.26, 0.09, -0.18]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
    <mesh position={[0.26, 0.09, -0.18]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
    <mesh position={[-0.26, 0.09, 0.22]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
    <mesh position={[0.26, 0.09, 0.22]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  </group>
);

export const SeatRow = ({
  row,
  layout,
}: {
  row: number;
  layout: TheaterLayout;
}) => {
  const offset = (layout.seatsPerRow - 1) * layout.seatSpacing * 0.5;
  const aisleLeft = layout.aisleCenterX - layout.aisleWidth / 2;
  const aisleRight = layout.aisleCenterX + layout.aisleWidth / 2;
  const z = layout.audienceStartZ + row * layout.rowSpacing;
  const y = 0.35 + row * layout.rowRise;

  return (
    <>
      {Array.from({ length: layout.seatsPerRow }).map((_, index) => {
        const x = index * layout.seatSpacing - offset;
        if (x >= aisleLeft && x <= aisleRight) return null;
        return <TheaterChair key={`${row}-${index}`} position={[x, y, z]} />;
      })}
    </>
  );
};

