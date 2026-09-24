import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { InstancedMesh } from "three";
import { tc } from "../../../../shared/styles/theme-color";
import type { TheaterLayout } from "../../../../shared/types/script";
import { enumerateAudienceSeats } from "../../model/theater-audience-arc";
import { getChairMetrics } from "../../model/theater-metrics";

type SeatMatrices = {
  seats: THREE.Matrix4[];
  backs: THREE.Matrix4[];
  seatSize: [number, number, number];
  backSize: [number, number, number];
};

function buildAudienceSeatMatrices(layout: TheaterLayout): SeatMatrices {
  const chair = getChairMetrics(layout.seatSpacing);
  const seats: THREE.Matrix4[] = [];
  const backs: THREE.Matrix4[] = [];
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();
  const backOffsetZ = chair.depth / 2 - 0.05;
  const backY = chair.seatThickness / 2 + chair.backHeight / 2;

  for (const seat of enumerateAudienceSeats(layout)) {
    const seatY = chair.floorY + seat.row * layout.rowRise + chair.seatThickness / 2;
    euler.set(0, seat.yaw, 0);
    quaternion.setFromEuler(euler);
    position.set(seat.x, seatY, seat.z);
    const seatMatrix = new THREE.Matrix4();
    seatMatrix.compose(position, quaternion, scale);
    seats.push(seatMatrix);

    position.set(
      seat.x - Math.sin(seat.yaw) * backOffsetZ,
      seatY + backY,
      seat.z - Math.cos(seat.yaw) * backOffsetZ,
    );
    const backMatrix = new THREE.Matrix4();
    backMatrix.compose(position, quaternion, scale);
    backs.push(backMatrix);
  }

  return {
    seats,
    backs,
    seatSize: [chair.width, chair.seatThickness, chair.depth],
    backSize: [chair.width, chair.backHeight, 0.08],
  };
}

function SeatInstances({
  matrices,
  size,
  color,
}: {
  matrices: THREE.Matrix4[];
  size: [number, number, number];
  color: string;
}) {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => {
      mesh.setMatrixAt(index, matrix);
    });
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh
      key={matrices.length}
      ref={meshRef}
      args={[undefined, undefined, matrices.length]}
      raycast={() => null}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

export function InstancedAudienceSeats({ layout }: { layout: TheaterLayout }) {
  const built = useMemo(() => buildAudienceSeatMatrices(layout), [layout]);
  if (built.seats.length === 0) return null;

  const seatColor = tc("--color-border-lighter");
  const backColor = tc("--color-surface-4");

  return (
    <>
      <SeatInstances matrices={built.seats} size={built.seatSize} color={seatColor} />
      <SeatInstances matrices={built.backs} size={built.backSize} color={backColor} />
    </>
  );
}
