import { tc } from "../../../../shared/styles/theme-color";
import { Instances, Instance } from "@react-three/drei";
import { useMemo } from "react";
import type { TheaterLayout } from "../../../../shared/types/script";
import { enumerateAudienceSeats } from "../../model/theater-audience-arc";
import { getChairMetrics } from "../../model/theater-metrics";

const AUDIENCE_SEAT_INSTANCE_LIMIT = 80 * 200;

type SeatTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

function buildAudienceSeatTransforms(layout: TheaterLayout): SeatTransform[] {
  const chair = getChairMetrics(layout.seatSpacing);
  return enumerateAudienceSeats(layout).map((seat) => {
    const y = chair.floorY + seat.row * layout.rowRise + chair.seatThickness / 2;
    return {
      position: [seat.x, y, seat.z],
      rotation: [0, seat.yaw, 0],
    };
  });
}

export function InstancedAudienceSeats({ layout }: { layout: TheaterLayout }) {
  const transforms = useMemo(() => buildAudienceSeatTransforms(layout), [layout]);
  const chair = useMemo(
    () => getChairMetrics(layout.seatSpacing),
    [layout.seatSpacing],
  );

  if (transforms.length === 0) return null;

  const seatColor = tc("--color-border-lighter");
  const backColor = tc("--color-surface-4");
  const drawn = Math.min(transforms.length, AUDIENCE_SEAT_INSTANCE_LIMIT);
  const backOffsetZ = chair.depth / 2 - 0.05;
  const backY = chair.seatThickness / 2 + chair.backHeight / 2;

  return (
    <>
      <Instances
        limit={AUDIENCE_SEAT_INSTANCE_LIMIT}
        range={drawn}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[chair.width, chair.seatThickness, chair.depth]} />
        <meshStandardMaterial color={seatColor} />
        {transforms.slice(0, drawn).map((item, index) => (
          <Instance key={`seat-${index}`} position={item.position} rotation={item.rotation} />
        ))}
      </Instances>
      <Instances
        limit={AUDIENCE_SEAT_INSTANCE_LIMIT}
        range={drawn}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[chair.width, chair.backHeight, 0.08]} />
        <meshStandardMaterial color={backColor} />
        {transforms.slice(0, drawn).map((item, index) => {
          const yaw = item.rotation[1];
          return (
            <Instance
              key={`back-${index}`}
              position={[
                item.position[0] - Math.sin(yaw) * backOffsetZ,
                item.position[1] + backY,
                item.position[2] - Math.cos(yaw) * backOffsetZ,
              ]}
              rotation={item.rotation}
            />
          );
        })}
      </Instances>
    </>
  );
}
