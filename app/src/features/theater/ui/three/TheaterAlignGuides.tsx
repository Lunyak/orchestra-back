import { Line } from "@react-three/drei";
import { tc } from "../../../../shared/styles/theme-color";
import type { TheaterLayout } from "../../../../shared/types/script";
import type { ActiveAlignGuide } from "../../model/theater-align-guides";

type TheaterAlignGuidesProps = {
  layout: TheaterLayout;
  guides: ActiveAlignGuide[];
  visible: boolean;
};

export function TheaterAlignGuides({ layout, guides, visible }: TheaterAlignGuidesProps) {
  if (!visible || guides.length === 0) return null;

  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const y = 0.02;
  const color = tc("--color-primary");

  return (
    <group>
      {guides.map((guide, index) => {
        if (guide.axis === "x") {
          return (
            <Line
              key={`guide-x-${guide.value}-${index}`}
              points={[
                [guide.value, y, -halfD],
                [guide.value, y, halfD],
              ]}
              color={color}
              lineWidth={1.5}
              transparent
              opacity={0.75}
            />
          );
        }
        return (
          <Line
            key={`guide-z-${guide.value}-${index}`}
            points={[
              [-halfW, y, guide.value],
              [halfW, y, guide.value],
            ]}
            color={color}
            lineWidth={1.5}
            transparent
            opacity={0.75}
          />
        );
      })}
    </group>
  );
}
