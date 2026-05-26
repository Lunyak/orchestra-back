import { tc } from "../../../../shared/styles/theme-color";
import type { TheaterLayout } from "../../../../shared/types/script";
import { getChairMetrics } from "../../model/theater-metrics";

export const TheaterChair = ({
  position,
  seatSpacing,
}: {
  position: [number, number, number];
  seatSpacing: number;
}) => {
  const chair = getChairMetrics(seatSpacing);
  const halfW = chair.width / 2;
  const halfD = chair.depth / 2;
  const leg = chair.leg;

  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, chair.seatThickness / 2, 0]}>
        <boxGeometry args={[chair.width, chair.seatThickness, chair.depth]} />
        <meshStandardMaterial color={tc("--color-border-lighter")} />
      </mesh>
      <mesh position={[0, chair.seatThickness + chair.backHeight / 2, -halfD + 0.05]}>
        <boxGeometry args={[chair.width, chair.backHeight, 0.1]} />
        <meshStandardMaterial color={tc("--color-surface-4")} />
      </mesh>
      <mesh position={[-halfW + leg / 2, leg / 2, -halfD + leg / 2]}>
        <boxGeometry args={[leg, leg, leg]} />
        <meshStandardMaterial color={tc("--color-surface-1")} />
      </mesh>
      <mesh position={[halfW - leg / 2, leg / 2, -halfD + leg / 2]}>
        <boxGeometry args={[leg, leg, leg]} />
        <meshStandardMaterial color={tc("--color-surface-1")} />
      </mesh>
      <mesh position={[-halfW + leg / 2, leg / 2, halfD - leg / 2]}>
        <boxGeometry args={[leg, leg, leg]} />
        <meshStandardMaterial color={tc("--color-surface-1")} />
      </mesh>
      <mesh position={[halfW - leg / 2, leg / 2, halfD - leg / 2]}>
        <boxGeometry args={[leg, leg, leg]} />
        <meshStandardMaterial color={tc("--color-surface-1")} />
      </mesh>
    </group>
  );
};

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
  const chair = getChairMetrics(layout.seatSpacing);
  const y = chair.floorY + row * layout.rowRise;

  return (
    <>
      {Array.from({ length: layout.seatsPerRow }).map((_, index) => {
        const x = index * layout.seatSpacing - offset;
        if (x >= aisleLeft && x <= aisleRight) return null;
        return (
          <TheaterChair
            key={`${row}-${index}`}
            position={[x, y, z]}
            seatSpacing={layout.seatSpacing}
          />
        );
      })}
    </>
  );
};
