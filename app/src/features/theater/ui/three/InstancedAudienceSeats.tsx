import { tc } from "../../../../shared/styles/theme-color";
import { Instances, Instance } from "@react-three/drei";
import { useMemo } from "react";
import type { TheaterLayout } from "../../../../shared/types/script";
import { getChairMetrics } from "../../model/theater-metrics";

type SeatTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

function buildAudienceSeatTransforms(layout: TheaterLayout): SeatTransform[] {
  const transforms: SeatTransform[] = [];
  const offset = (layout.seatsPerRow - 1) * layout.seatSpacing * 0.5;
  const aisleLeft = layout.aisleCenterX - layout.aisleWidth / 2;
  const aisleRight = layout.aisleCenterX + layout.aisleWidth / 2;
  const chair = getChairMetrics(layout.seatSpacing);

  for (let row = 0; row < layout.seatRows; row += 1) {
    const z = layout.audienceStartZ + row * layout.rowSpacing;
    const y = chair.floorY + row * layout.rowRise;
    for (let index = 0; index < layout.seatsPerRow; index += 1) {
      const x = index * layout.seatSpacing - offset;
      if (x >= aisleLeft && x <= aisleRight) continue;
      transforms.push({
        position: [x, y + chair.seatThickness / 2, z],
        rotation: [0, Math.PI, 0],
      });
    }
  }

  return transforms;
}

export function InstancedAudienceSeats({ layout }: { layout: TheaterLayout }) {
  const transforms = useMemo(() => buildAudienceSeatTransforms(layout), [layout]);
  const chair = useMemo(
    () => getChairMetrics(layout.seatSpacing),
    [layout.seatSpacing],
  );

  if (transforms.length === 0) return null;

  const seatColor = tc("--color-border-lighter");
  const limit = Math.max(transforms.length, 1);

  return (
    <Instances limit={limit}>
      <boxGeometry args={[chair.width, chair.seatThickness, chair.depth]} />
      <meshStandardMaterial color={seatColor} />
      {transforms.map((item, index) => (
        <Instance key={index} position={item.position} rotation={item.rotation} />
      ))}
    </Instances>
  );
}
