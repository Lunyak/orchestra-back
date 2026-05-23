import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { SeatRow } from "./theater-seating";

export const TheaterStage = ({ layout }: { layout: TheaterLayout }) => (
  <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[6, 8, 4]} intensity={1.1} castShadow />

    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[layout.hallWidth, layout.hallDepth]} />
      <meshStandardMaterial color="#111827" />
    </mesh>

    <mesh position={[0, layout.wallHeight / 2, -layout.hallDepth / 2]} receiveShadow>
      <planeGeometry args={[layout.hallWidth, layout.wallHeight]} />
      <meshStandardMaterial color="#0f172a" side={THREE.FrontSide} />
    </mesh>

    <mesh
      position={[-layout.hallWidth / 2, layout.wallHeight / 2, 0]}
      rotation={[0, Math.PI / 2, 0]}
      receiveShadow
    >
      <planeGeometry args={[layout.hallDepth, layout.wallHeight]} />
      <meshStandardMaterial color="#111827" side={THREE.FrontSide} />
    </mesh>

    <mesh
      position={[layout.hallWidth / 2, layout.wallHeight / 2, 0]}
      rotation={[0, -Math.PI / 2, 0]}
      receiveShadow
    >
      <planeGeometry args={[layout.hallDepth, layout.wallHeight]} />
      <meshStandardMaterial color="#111827" side={THREE.FrontSide} />
    </mesh>

    <mesh
      position={[-layout.hallWidth / 2 + 0.02, layout.doorHeight / 2, layout.doorZ]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <planeGeometry args={[layout.doorWidth, layout.doorHeight]} />
      <meshStandardMaterial color="#22c55e" side={THREE.FrontSide} />
    </mesh>

    {Array.from({ length: layout.seatRows }).map((_, row) => (
      <SeatRow key={row} row={row} layout={layout} />
    ))}
  </>
);
